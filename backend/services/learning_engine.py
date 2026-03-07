"""
Adaptive Learning Engine – HLR-based spaced repetition for speech therapy.

Uses a Half-Life Regression (HLR) model inspired by Duolingo's approach:
  recall_probability = 2 ** (-delta / half_life)

Where:
  - delta = seconds since last practice
  - half_life = learned parameter per item (starts from difficulty-based default)

Correct answers increase half-life (slower decay → less frequent review).
Incorrect answers shrink half-life (faster decay → sooner review).

Advancement criteria:
  - ≥80% accuracy on 3 consecutive sessions → advance difficulty
  - <50% on 2 consecutive sessions → increase support / suggest easier items

All public functions accept an optional user_id (int).
  user_id == 0  →  legacy JSON file storage (backwards compat / dev)
  user_id  > 0  →  per-user SQLite storage
"""

import json
import math
import os
import time
from typing import Any

# ── Paths ────────────────────────────────────────────────────────────────────

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_PROGRESS_PATH = os.path.join(_DATA_DIR, "user_progress.json")
_TARGET_WORDS_PATH = os.path.join(_DATA_DIR, "target_words.json")
_TARGET_MELODIES_PATH = os.path.join(_DATA_DIR, "target_melodies.json")

# ── Constants ────────────────────────────────────────────────────────────────

DEFAULT_HALF_LIVES = {
    1: 86400 * 4,
    2: 86400 * 2,
    3: 86400,
    4: 43200,
    5: 21600,
}

CORRECT_MULTIPLIER = 2.0
INCORRECT_DIVISOR  = 2.0
PASS_THRESHOLD     = 70
MIN_HALF_LIFE      = 3600
MAX_HALF_LIFE      = 86400 * 30

ADVANCE_THRESHOLD  = 80
ADVANCE_STREAK     = 3
SUPPORT_THRESHOLD  = 50
SUPPORT_STREAK     = 2

WORDS_PER_SESSION   = 3
PHRASES_PER_SESSION = 1


# ── Data loading ──────────────────────────────────────────────────────────────

def _load_words() -> list[dict]:
    with open(_TARGET_WORDS_PATH) as f:
        return json.load(f)


def _load_melodies() -> dict:
    with open(_TARGET_MELODIES_PATH) as f:
        return json.load(f)


def _load_progress(user_id: int = 0) -> dict:
    if user_id > 0:
        from database import get_db
        db = get_db()
        row = db.execute(
            "SELECT progress_json FROM user_progress WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row:
            return json.loads(row["progress_json"])
        return _init_progress(user_id)
    else:
        if os.path.exists(_PROGRESS_PATH):
            with open(_PROGRESS_PATH) as f:
                return json.load(f)
        return _init_progress(0)


def _save_progress(progress: dict, user_id: int = 0):
    if user_id > 0:
        from database import get_db
        db = get_db()
        db.execute(
            "INSERT OR REPLACE INTO user_progress (user_id, progress_json, updated_at) VALUES (?, ?, ?)",
            (user_id, json.dumps(progress), time.time()),
        )
        db.commit()
    else:
        os.makedirs(os.path.dirname(_PROGRESS_PATH), exist_ok=True)
        with open(_PROGRESS_PATH, "w") as f:
            json.dump(progress, f, indent=2)


def _init_progress(user_id: int = 0) -> dict:
    """Create a fresh progress record for a user."""
    words   = _load_words()
    melodies = _load_melodies()

    progress = {
        "created_at": time.time(),
        "current_difficulty": 1,
        "total_sessions": 0,
        "total_practice_time_s": 0,
        "words": {},
        "phrases": {},
        "session_history": [],
    }

    for w in words:
        word = w["word"]
        diff = w.get("difficulty", 1)
        progress["words"][word] = {
            "difficulty": diff,
            "half_life": DEFAULT_HALF_LIVES.get(diff, 86400),
            "last_practiced": 0,
            "times_practiced": 0,
            "best_score": 0,
            "recent_scores": [],
            "consecutive_good": 0,
            "consecutive_bad": 0,
            "unlocked": diff <= 1,
            "phoneme_scores": {},
        }

    for phrase_id, phrase in melodies.items():
        level = phrase.get("level", 1)
        progress["phrases"][phrase_id] = {
            "level": level,
            "half_life": DEFAULT_HALF_LIVES.get(level + 1, 86400),
            "last_practiced": 0,
            "times_practiced": 0,
            "best_score": 0,
            "recent_scores": [],
            "consecutive_good": 0,
            "consecutive_bad": 0,
            "unlocked": level <= 1,
        }

    _save_progress(progress, user_id)
    return progress


# ── Recall probability ────────────────────────────────────────────────────────

def _recall_probability(half_life: float, last_practiced: float) -> float:
    if last_practiced == 0:
        return 0.0
    delta = time.time() - last_practiced
    if delta <= 0:
        return 1.0
    return 2.0 ** (-delta / max(half_life, MIN_HALF_LIFE))


# ── Word selection ────────────────────────────────────────────────────────────

def get_next_words(count: int = WORDS_PER_SESSION, user_id: int = 0) -> list[dict]:
    progress   = _load_progress(user_id)
    words_data = _load_words()
    word_lookup = {w["word"]: w for w in words_data}

    candidates = []
    new_words  = []

    for word, state in progress["words"].items():
        if not state["unlocked"]:
            continue
        p = _recall_probability(state["half_life"], state["last_practiced"])
        entry = {
            "word": word,
            "recall_probability": p,
            "times_practiced": state["times_practiced"],
            "best_score": state["best_score"],
            "difficulty": state["difficulty"],
            "phonemes": word_lookup.get(word, {}).get("phonemes", []),
            "category": word_lookup.get(word, {}).get("category", "daily"),
        }
        if state["times_practiced"] == 0:
            new_words.append(entry)
        else:
            candidates.append(entry)

    candidates.sort(key=lambda x: x["recall_probability"])

    selected  = []
    new_slot  = 1 if new_words else 0
    review_slots = count - new_slot

    selected.extend(candidates[:review_slots])

    if new_words:
        new_words.sort(key=lambda x: x["difficulty"])
        selected.append(new_words[0])

    if len(selected) < count:
        remaining = [w for w in new_words + candidates if w not in selected]
        for item in remaining:
            if len(selected) >= count:
                break
            selected.append(item)

    return selected[:count]


# ── Phrase selection ──────────────────────────────────────────────────────────

def get_next_phrase(user_id: int = 0) -> dict | None:
    progress = _load_progress(user_id)
    melodies = _load_melodies()

    candidates = []
    for phrase_id, state in progress["phrases"].items():
        if not state["unlocked"]:
            continue
        p = _recall_probability(state["half_life"], state["last_practiced"])
        phrase_data = melodies.get(phrase_id, {})
        candidates.append({
            "phrase_id": phrase_id,
            "text": phrase_data.get("text", ""),
            "level": state["level"],
            "recall_probability": p,
            "times_practiced": state["times_practiced"],
            "best_score": state["best_score"],
            "duration": phrase_data.get("duration_seconds", 2.0),
        })

    if not candidates:
        return None

    candidates.sort(key=lambda x: (x["times_practiced"] > 0, x["recall_probability"]))
    return candidates[0]


# ── Record results ────────────────────────────────────────────────────────────

def record_word_result(word: str, score: int, phoneme_details: list[dict] | None = None, user_id: int = 0):
    progress = _load_progress(user_id)

    if word not in progress["words"]:
        return

    state = progress["words"][word]
    state["last_practiced"]   = time.time()
    state["times_practiced"] += 1
    state["best_score"]       = max(state["best_score"], score)

    state["recent_scores"].append(score)
    if len(state["recent_scores"]) > 10:
        state["recent_scores"] = state["recent_scores"][-10:]

    if score >= PASS_THRESHOLD:
        state["half_life"]       = min(state["half_life"] * CORRECT_MULTIPLIER, MAX_HALF_LIFE)
        state["consecutive_bad"] = 0
    else:
        state["half_life"]        = max(state["half_life"] / INCORRECT_DIVISOR, MIN_HALF_LIFE)
        state["consecutive_good"] = 0

    if score >= ADVANCE_THRESHOLD:
        state["consecutive_good"] += 1
    else:
        state["consecutive_good"]  = 0

    if score < SUPPORT_THRESHOLD:
        state["consecutive_bad"] += 1
    else:
        state["consecutive_bad"]  = 0

    if phoneme_details:
        for ph in phoneme_details:
            ph_name = ph.get("phoneme", "")
            ph_acc  = ph.get("accuracy", 0)
            if ph_name not in state["phoneme_scores"]:
                state["phoneme_scores"][ph_name] = []
            state["phoneme_scores"][ph_name].append(ph_acc)
            if len(state["phoneme_scores"][ph_name]) > 10:
                state["phoneme_scores"][ph_name] = state["phoneme_scores"][ph_name][-10:]

    _check_advancement(progress)
    _save_progress(progress, user_id)


def record_phrase_result(phrase_id: str, score: int, user_id: int = 0):
    progress = _load_progress(user_id)

    if phrase_id not in progress["phrases"]:
        return

    state = progress["phrases"][phrase_id]
    state["last_practiced"]   = time.time()
    state["times_practiced"] += 1
    state["best_score"]       = max(state["best_score"], score)

    state["recent_scores"].append(score)
    if len(state["recent_scores"]) > 10:
        state["recent_scores"] = state["recent_scores"][-10:]

    if score >= PASS_THRESHOLD:
        state["half_life"]       = min(state["half_life"] * CORRECT_MULTIPLIER, MAX_HALF_LIFE)
        state["consecutive_bad"] = 0
    else:
        state["half_life"]        = max(state["half_life"] / INCORRECT_DIVISOR, MIN_HALF_LIFE)
        state["consecutive_good"] = 0

    if score >= ADVANCE_THRESHOLD:
        state["consecutive_good"] += 1
    else:
        state["consecutive_good"]  = 0

    if score < SUPPORT_THRESHOLD:
        state["consecutive_bad"] += 1
    else:
        state["consecutive_bad"]  = 0

    _check_phrase_advancement(progress)
    _save_progress(progress, user_id)


def record_session(session_type: str, scores: dict[str, int], duration_s: float = 0, user_id: int = 0):
    progress = _load_progress(user_id)
    progress["total_sessions"]        += 1
    progress["total_practice_time_s"] += duration_s

    progress["session_history"].append({
        "timestamp":  time.time(),
        "type":       session_type,
        "scores":     scores,
        "duration_s": duration_s,
    })

    if len(progress["session_history"]) > 100:
        progress["session_history"] = progress["session_history"][-100:]

    _save_progress(progress, user_id)


# ── Advancement logic ─────────────────────────────────────────────────────────

def _check_advancement(progress: dict):
    current_diff   = progress["current_difficulty"]
    words_at_level = [
        w for w in progress["words"].values()
        if w["difficulty"] == current_diff and w["unlocked"]
    ]

    if not words_at_level:
        return

    mastered = sum(1 for w in words_at_level if w["consecutive_good"] >= ADVANCE_STREAK)
    total    = len(words_at_level)

    if total > 0 and mastered / total >= 0.6:
        next_diff    = current_diff + 1
        any_unlocked = False
        for word, state in progress["words"].items():
            if state["difficulty"] == next_diff and not state["unlocked"]:
                state["unlocked"] = True
                any_unlocked = True
        if any_unlocked:
            progress["current_difficulty"] = next_diff


def _check_phrase_advancement(progress: dict):
    unlocked_levels = {s["level"] for s in progress["phrases"].values() if s["unlocked"]}
    if not unlocked_levels:
        return

    max_level       = max(unlocked_levels)
    phrases_at_level = [
        s for s in progress["phrases"].values()
        if s["level"] == max_level and s["unlocked"]
    ]

    mastered = sum(1 for s in phrases_at_level if s["consecutive_good"] >= ADVANCE_STREAK)
    total    = len(phrases_at_level)

    if total > 0 and mastered / total >= 0.5:
        next_level = max_level + 1
        for phrase_id, state in progress["phrases"].items():
            if state["level"] == next_level and not state["unlocked"]:
                state["unlocked"] = True


# ── Stats & progress overview ─────────────────────────────────────────────────

def get_progress_summary(user_id: int = 0) -> dict[str, Any]:
    progress   = _load_progress(user_id)
    words_data = _load_words()

    total_words    = len(progress["words"])
    unlocked_words = sum(1 for w in progress["words"].values() if w["unlocked"])
    practiced_words = sum(1 for w in progress["words"].values() if w["times_practiced"] > 0)
    mastered_words = sum(
        1 for w in progress["words"].values()
        if w["consecutive_good"] >= ADVANCE_STREAK
    )

    all_recent = []
    for w in progress["words"].values():
        all_recent.extend(w["recent_scores"])
    avg_word_score = round(sum(all_recent) / len(all_recent)) if all_recent else 0

    total_phrases    = len(progress["phrases"])
    unlocked_phrases = sum(1 for p in progress["phrases"].values() if p["unlocked"])
    practiced_phrases = sum(1 for p in progress["phrases"].values() if p["times_practiced"] > 0)

    all_phrase_scores = []
    for p in progress["phrases"].values():
        all_phrase_scores.extend(p["recent_scores"])
    avg_phrase_score = round(sum(all_phrase_scores) / len(all_phrase_scores)) if all_phrase_scores else 0

    phoneme_avgs: dict[str, list[float]] = {}
    for w in progress["words"].values():
        for ph, scores in w.get("phoneme_scores", {}).items():
            if ph not in phoneme_avgs:
                phoneme_avgs[ph] = []
            phoneme_avgs[ph].extend(scores)

    weak_phonemes = []
    for ph, scores in phoneme_avgs.items():
        avg = sum(scores) / len(scores)
        if avg < 70:
            weak_phonemes.append({"phoneme": ph, "avg_accuracy": round(avg)})
    weak_phonemes.sort(key=lambda x: x["avg_accuracy"])

    diff_breakdown: dict[str, dict] = {}
    for w in progress["words"].values():
        d = str(w["difficulty"])
        if d not in diff_breakdown:
            diff_breakdown[d] = {"total": 0, "unlocked": 0, "mastered": 0}
        diff_breakdown[d]["total"] += 1
        if w["unlocked"]:
            diff_breakdown[d]["unlocked"] += 1
        if w["consecutive_good"] >= ADVANCE_STREAK:
            diff_breakdown[d]["mastered"] += 1

    streak_days = _compute_streak(progress["session_history"])

    return {
        "current_difficulty": progress["current_difficulty"],
        "total_sessions": progress["total_sessions"],
        "total_practice_time_minutes": round(progress["total_practice_time_s"] / 60, 1),
        "streak_days": streak_days,
        "words": {
            "total": total_words,
            "unlocked": unlocked_words,
            "practiced": practiced_words,
            "mastered": mastered_words,
            "avg_score": avg_word_score,
        },
        "phrases": {
            "total": total_phrases,
            "unlocked": unlocked_phrases,
            "practiced": practiced_phrases,
            "avg_score": avg_phrase_score,
        },
        "weak_phonemes": weak_phonemes[:5],
        "difficulty_breakdown": diff_breakdown,
        "recent_sessions": progress["session_history"][-10:],
    }


def _compute_streak(sessions: list[dict]) -> int:
    if not sessions:
        return 0

    practice_dates = set()
    for s in sessions:
        ts = s.get("timestamp", 0)
        if ts > 0:
            practice_dates.add(time.strftime("%Y-%m-%d", time.localtime(ts)))

    if not practice_dates:
        return 0

    streak  = 0
    current = time.time()
    for i in range(365):
        day = time.strftime("%Y-%m-%d", time.localtime(current - i * 86400))
        if day in practice_dates:
            streak += 1
        elif i == 0:
            continue
        else:
            break
    return streak


# ── Progress history (for charts) ────────────────────────────────────────────

def get_progress_history(days: int = 30, user_id: int = 0) -> dict:
    """Return per-session score history and weekly activity for charts."""
    progress = _load_progress(user_id)
    cutoff   = time.time() - days * 86400

    sessions = []
    for s in progress.get("session_history", []):
        if s.get("timestamp", 0) < cutoff:
            continue
        scores = list(s.get("scores", {}).values())
        avg    = round(sum(scores) / len(scores)) if scores else 0
        sessions.append({
            "date":       time.strftime("%Y-%m-%d", time.localtime(s["timestamp"])),
            "timestamp":  s["timestamp"],
            "type":       s.get("type", "assessment"),
            "avg_score":  avg,
            "duration_s": s.get("duration_s", 0),
            "word_count": len(s.get("scores", {})),
        })
    sessions.sort(key=lambda x: x["timestamp"])

    # Weekly activity: sessions per day for last 7 days
    now    = time.time()
    weekly = []
    all_history = progress.get("session_history", [])
    for i in range(6, -1, -1):
        day_ts  = now - i * 86400
        day_str = time.strftime("%Y-%m-%d", time.localtime(day_ts))
        label   = time.strftime("%a",       time.localtime(day_ts))
        count   = sum(
            1 for s in all_history
            if time.strftime("%Y-%m-%d", time.localtime(s.get("timestamp", 0))) == day_str
        )
        weekly.append({"date": day_str, "label": label, "count": count})

    return {"sessions": sessions, "weekly": weekly}


def get_phoneme_history(user_id: int = 0) -> dict:
    """Return per-phoneme accuracy averages and trends for the heatmap."""
    progress = _load_progress(user_id)

    phoneme_all: dict[str, list[float]] = {}
    for w in progress.get("words", {}).values():
        for ph, scores in w.get("phoneme_scores", {}).items():
            if ph not in phoneme_all:
                phoneme_all[ph] = []
            phoneme_all[ph].extend(scores)

    result = []
    for ph, scores in phoneme_all.items():
        if not scores:
            continue
        n   = len(scores)
        avg = sum(scores) / n

        # Trend: compare first half vs second half of score history
        if n >= 4:
            mid    = n // 2
            first  = sum(scores[:mid]) / mid
            second = sum(scores[mid:]) / (n - mid)
            diff   = second - first
            trend  = "improving" if diff > 5 else ("declining" if diff < -5 else "stable")
        else:
            trend = "stable"

        result.append({
            "phoneme":      ph,
            "avg_accuracy": round(avg),
            "scores":       scores[-5:],
            "trend":        trend,
            "count":        n,
        })

    result.sort(key=lambda x: x["avg_accuracy"])
    return {"phonemes": result}


# ── Word details ──────────────────────────────────────────────────────────────

def get_word_details(word: str, user_id: int = 0) -> dict | None:
    progress = _load_progress(user_id)
    if word not in progress["words"]:
        return None

    state = progress["words"][word]
    p     = _recall_probability(state["half_life"], state["last_practiced"])

    return {
        "word":             word,
        "difficulty":       state["difficulty"],
        "unlocked":         state["unlocked"],
        "times_practiced":  state["times_practiced"],
        "best_score":       state["best_score"],
        "recent_scores":    state["recent_scores"],
        "recall_probability": round(p, 3),
        "half_life_hours":  round(state["half_life"] / 3600, 1),
        "consecutive_good": state["consecutive_good"],
        "consecutive_bad":  state["consecutive_bad"],
        "phoneme_scores": {
            ph: round(sum(sc) / len(sc)) if sc else 0
            for ph, sc in state.get("phoneme_scores", {}).items()
        },
        "needs_support": state["consecutive_bad"] >= SUPPORT_STREAK,
        "mastered":      state["consecutive_good"] >= ADVANCE_STREAK,
    }


def reset_progress(user_id: int = 0):
    return _init_progress(user_id)


# ── Daily Missions (redesigned for specificity) ───────────────────────────────

def get_daily_missions(user_id: int = 0) -> list[dict]:
    progress = _load_progress(user_id)
    today    = time.strftime("%Y-%m-%d", time.localtime())

    cached = progress.get("missions", {})
    if cached.get("date") == today and cached.get("items"):
        return _refresh_mission_status(cached["items"], progress)

    missions = _generate_missions(progress)
    progress["missions"] = {"date": today, "items": missions}
    _save_progress(progress, user_id)
    return missions


def _generate_missions(progress: dict) -> list[dict]:
    """Build 5-6 daily missions that are specific, clinically relevant, and varied."""
    missions       = []
    mid            = 0
    total_sessions = progress["total_sessions"]
    current_diff   = progress["current_difficulty"]
    words_data     = _load_words()
    word_lookup    = {w["word"]: w for w in words_data}

    # Aggregate per-phoneme averages to find weakest phoneme
    phoneme_avgs: dict[str, list[float]] = {}
    for w_data in progress["words"].values():
        for ph, scores in w_data.get("phoneme_scores", {}).items():
            if ph not in phoneme_avgs:
                phoneme_avgs[ph] = []
            phoneme_avgs[ph].extend(scores)

    weakest_phoneme = None
    weakest_avg     = 0
    if phoneme_avgs:
        sorted_ph       = sorted(phoneme_avgs.items(), key=lambda x: sum(x[1]) / len(x[1]))
        weakest_phoneme = sorted_ph[0][0]
        weakest_avg     = round(sum(sorted_ph[0][1]) / len(sorted_ph[0][1]))

    # Words that contain the weakest phoneme and are unlocked
    weak_phoneme_words = []
    if weakest_phoneme:
        weak_phoneme_words = [
            w for w, state in progress["words"].items()
            if state["unlocked"] and weakest_phoneme in word_lookup.get(w, {}).get("phonemes", [])
        ]

    # ── Mission 1: Phoneme drill OR first-session intro ───────────────────
    if total_sessions == 0:
        missions.append({
            "id": f"m{mid}", "icon": "🎯", "xp": 50,
            "title": "First Steps",
            "description": "Complete your first speech assessment",
            "type": "session", "target": 1,
        })
    elif weak_phoneme_words and weakest_phoneme:
        target_count = min(3, len(weak_phoneme_words))
        missions.append({
            "id": f"m{mid}", "icon": "🎯", "xp": 45,
            "title": f"/{weakest_phoneme}/ Sound Drill",
            "description": f"Practice {target_count} words with the /{weakest_phoneme}/ sound (your avg: {weakest_avg}%)",
            "type": "phoneme_drill",
            "target_phoneme": weakest_phoneme,
            "target": target_count,
        })
    else:
        t = 2 if total_sessions < 5 else 3
        missions.append({
            "id": f"m{mid}", "icon": "📝", "xp": 30,
            "title": "Daily Practice",
            "description": f"Complete {t} practice sessions today",
            "type": "session", "target": t,
        })
    mid += 1

    # ── Mission 2: Beat personal best on a specific word ─────────────────
    improvable = [
        (w, s) for w, s in progress["words"].items()
        if s["unlocked"] and s["times_practiced"] > 0
        and s["recent_scores"] and s["best_score"] < 95
    ]
    if improvable:
        target_word, target_state = min(
            improvable,
            key=lambda x: sum(x[1]["recent_scores"]) / len(x[1]["recent_scores"])
        )
        current_best = target_state["best_score"]
        target_score = min(current_best + 10, 95)
        missions.append({
            "id": f"m{mid}", "icon": "⭐", "xp": 40,
            "title": "Beat Your Best",
            "description": f'Score {target_score}%+ on "{target_word}" (your best: {current_best}%)',
            "type": "word_score",
            "target_word": target_word,
            "target_score": target_score,
        })
    else:
        missions.append({
            "id": f"m{mid}", "icon": "⭐", "xp": 50,
            "title": "Excellence",
            "description": "Score 90%+ on any word",
            "type": "any_word_score", "target_score": 90,
        })
    mid += 1

    # ── Mission 3: Review stale words OR explore new ones ────────────────
    three_days_ago = time.time() - 3 * 86400
    stale = [
        w for w, s in progress["words"].items()
        if s["unlocked"] and s["times_practiced"] > 0
        and s["last_practiced"] < three_days_ago
    ]
    new_words_list = [
        w for w, s in progress["words"].items()
        if s["unlocked"] and s["times_practiced"] == 0
    ]

    if stale:
        target_stale = stale[:3]
        names        = " & ".join(f'"{w}"' for w in target_stale[:2])
        missions.append({
            "id": f"m{mid}", "icon": "🔄", "xp": 30,
            "title": "Don't Forget!",
            "description": f"Review {names} (3+ days since last practice)",
            "type": "review_words",
            "target_words": target_stale,
            "target": min(2, len(stale)),
        })
    elif new_words_list:
        missions.append({
            "id": f"m{mid}", "icon": "🔍", "xp": 25,
            "title": "Explorer",
            "description": f'Try a word you\'ve never practiced: "{new_words_list[0]}"',
            "type": "new_word", "target": 1,
        })
    else:
        missions.append({
            "id": f"m{mid}", "icon": "🏆", "xp": 35,
            "title": "Review Champion",
            "description": "Practice 5 different words today",
            "type": "unique_words", "target": 5,
        })
    mid += 1

    # ── Mission 4: Melody therapy with quality target ─────────────────────
    unlocked_phrases = [p for p, s in progress["phrases"].items() if s["unlocked"]]
    if unlocked_phrases:
        missions.append({
            "id": f"m{mid}", "icon": "🎵", "xp": 35,
            "title": "Melody Therapy",
            "description": "Complete a melody session with 70%+ pitch accuracy",
            "type": "melody_score", "target_score": 70,
        })
    else:
        missions.append({
            "id": f"m{mid}", "icon": "🎵", "xp": 30,
            "title": "Sing Along",
            "description": "Complete a melody therapy session",
            "type": "melody", "target": 1,
        })
    mid += 1

    # ── Mission 5: Practice time (5 minutes) ─────────────────────────────
    missions.append({
        "id": f"m{mid}", "icon": "⏱️", "xp": 20,
        "title": "5-Minute Focus",
        "description": "Practice for 5 minutes total today",
        "type": "practice_time", "target": 300,
    })
    mid += 1

    # ── Bonus: Challenge a locked word ───────────────────────────────────
    challenge_candidates = [
        (w, s) for w, s in progress["words"].items()
        if not s["unlocked"] and s["difficulty"] == current_diff + 1
    ]
    if challenge_candidates:
        cw = challenge_candidates[0][0]
        missions.append({
            "id": f"m{mid}", "icon": "🔥", "xp": 75,
            "title": "Challenge Mode",
            "description": f'Unlock "{cw}" — a Level {current_diff + 1} word',
            "type": "challenge", "target_word": cw, "bonus": True,
        })

    return _refresh_mission_status(missions, progress)


def _refresh_mission_status(missions: list[dict], progress: dict) -> list[dict]:
    """Update each mission's current progress and completed status from live data."""
    today_start  = time.mktime(time.strptime(time.strftime("%Y-%m-%d"), "%Y-%m-%d"))
    all_sessions = progress.get("session_history", [])
    today_sessions = [s for s in all_sessions if s.get("timestamp", 0) >= today_start]
    today_melody   = [s for s in today_sessions if s.get("type") == "melody"]
    today_time_s   = sum(s.get("duration_s", 0) for s in today_sessions)

    words_data  = _load_words()
    word_lookup = {w["word"]: w for w in words_data}

    words_today: set[str]      = set()
    word_best:   dict[str, int] = {}
    for s in today_sessions:
        for w, score in s.get("scores", {}).items():
            words_today.add(w)
            word_best[w] = max(word_best.get(w, 0), score)

    melody_scores_today = []
    for s in today_melody:
        melody_scores_today.extend(s.get("scores", {}).values())

    for m in missions:
        mt = m["type"]

        if mt == "session":
            m["current"]   = len(today_sessions)
            m["completed"] = m["current"] >= m["target"]

        elif mt == "phoneme_drill":
            target_ph = m.get("target_phoneme", "")
            count = sum(
                1 for w in words_today
                if target_ph in word_lookup.get(w, {}).get("phonemes", [])
            )
            m["current"]   = count
            m["completed"] = count >= m.get("target", 3)

        elif mt == "word_score":
            best = word_best.get(m.get("target_word", ""), 0)
            m["current"]   = best
            m["completed"] = best >= m.get("target_score", 80)

        elif mt == "any_word_score":
            best = max(word_best.values()) if word_best else 0
            m["current"]   = best
            m["completed"] = best >= m.get("target_score", 90)

        elif mt == "new_word":
            new_count = sum(
                1 for w in words_today
                if progress["words"].get(w, {}).get("times_practiced", 0) <= 1
            )
            m["current"]   = new_count
            m["completed"] = new_count >= m.get("target", 1)

        elif mt == "review_words":
            reviewed = sum(1 for w in m.get("target_words", []) if w in words_today)
            m["current"]   = reviewed
            m["completed"] = reviewed >= m.get("target", 2)

        elif mt == "unique_words":
            m["current"]   = len(words_today)
            m["completed"] = m["current"] >= m.get("target", 5)

        elif mt == "melody":
            m["current"]   = len(today_melody)
            m["completed"] = m["current"] >= m.get("target", 1)

        elif mt == "melody_score":
            best = max(melody_scores_today) if melody_scores_today else 0
            m["current"]   = best
            m["completed"] = best >= m.get("target_score", 70)

        elif mt == "practice_time":
            m["current"]   = round(today_time_s)
            m["completed"] = today_time_s >= m.get("target", 300)

        elif mt == "challenge":
            m["current"]   = 1 if m.get("target_word", "") in words_today else 0
            m["completed"] = m["current"] >= 1

    return missions


# ── Challenge Mode ────────────────────────────────────────────────────────────

def get_all_words_by_difficulty(user_id: int = 0) -> dict[str, Any]:
    progress   = _load_progress(user_id)
    words_data = _load_words()
    word_lookup = {w["word"]: w for w in words_data}
    levels: dict[int, list] = {}

    for word, state in progress["words"].items():
        diff = state["difficulty"]
        if diff not in levels:
            levels[diff] = []
        meta = word_lookup.get(word, {})
        p    = _recall_probability(state["half_life"], state["last_practiced"])
        levels[diff].append({
            "word":             word,
            "difficulty":       diff,
            "category":         meta.get("category", "daily"),
            "phonemes":         meta.get("phonemes", []),
            "unlocked":         state["unlocked"],
            "times_practiced":  state["times_practiced"],
            "best_score":       state["best_score"],
            "mastered":         state["consecutive_good"] >= ADVANCE_STREAK,
            "recall_probability": round(p, 3),
        })

    for diff in levels:
        levels[diff].sort(key=lambda x: (x["mastered"], -x["best_score"]))

    return {
        "current_difficulty": progress["current_difficulty"],
        "levels": {str(k): v for k, v in sorted(levels.items())},
    }
