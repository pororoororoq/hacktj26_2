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

# Default half-lives (seconds) by difficulty level
DEFAULT_HALF_LIVES = {
    1: 86400 * 4,    # 4 days – easiest words
    2: 86400 * 2,    # 2 days
    3: 86400,        # 1 day
    4: 43200,        # 12 hours
    5: 21600,        # 6 hours – hardest words
}

# HLR tuning
CORRECT_MULTIPLIER = 2.0     # double half-life on success
INCORRECT_DIVISOR = 2.0      # halve half-life on failure
PASS_THRESHOLD = 70          # score >= 70% counts as "correct"
MIN_HALF_LIFE = 3600         # 1 hour floor
MAX_HALF_LIFE = 86400 * 30   # 30-day ceiling

# Advancement / support
ADVANCE_THRESHOLD = 80       # score needed
ADVANCE_STREAK = 3           # consecutive good sessions
SUPPORT_THRESHOLD = 50       # below this triggers support
SUPPORT_STREAK = 2           # consecutive bad sessions

# Session config
WORDS_PER_SESSION = 3
PHRASES_PER_SESSION = 1


# ── Data loading ─────────────────────────────────────────────────────────────

def _load_words() -> list[dict]:
    with open(_TARGET_WORDS_PATH) as f:
        return json.load(f)


def _load_melodies() -> dict:
    with open(_TARGET_MELODIES_PATH) as f:
        return json.load(f)


def _load_progress() -> dict:
    if os.path.exists(_PROGRESS_PATH):
        with open(_PROGRESS_PATH) as f:
            return json.load(f)
    return _init_progress()


def _save_progress(progress: dict):
    os.makedirs(os.path.dirname(_PROGRESS_PATH), exist_ok=True)
    with open(_PROGRESS_PATH, "w") as f:
        json.dump(progress, f, indent=2)


def _init_progress() -> dict:
    """Create a fresh progress file with all words and phrases."""
    words = _load_words()
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
            "recent_scores": [],       # last N scores
            "consecutive_good": 0,     # streak of ≥80%
            "consecutive_bad": 0,      # streak of <50%
            "unlocked": diff <= 1,     # only difficulty 1 unlocked initially
            "phoneme_scores": {},      # per-phoneme tracking
        }

    for phrase_id, phrase in melodies.items():
        level = phrase.get("level", 1)
        progress["phrases"][phrase_id] = {
            "level": level,
            "half_life": DEFAULT_HALF_LIVES.get(level + 1, 86400),  # slightly harder curve
            "last_practiced": 0,
            "times_practiced": 0,
            "best_score": 0,
            "recent_scores": [],
            "consecutive_good": 0,
            "consecutive_bad": 0,
            "unlocked": level <= 1,
        }

    _save_progress(progress)
    return progress


# ── Recall probability ───────────────────────────────────────────────────────

def _recall_probability(half_life: float, last_practiced: float) -> float:
    """Compute p = 2^(-delta/h). Returns 1.0 if never practiced."""
    if last_practiced == 0:
        return 0.0  # never practiced → highest priority
    delta = time.time() - last_practiced
    if delta <= 0:
        return 1.0
    return 2.0 ** (-delta / max(half_life, MIN_HALF_LIFE))


# ── Word selection (Duolingo-style) ──────────────────────────────────────────

def get_next_words(count: int = WORDS_PER_SESSION) -> list[dict]:
    """
    Select the next words to practice using HLR priority scheduling.

    Strategy:
      1. Never-practiced unlocked words first (cold-start)
      2. Lowest recall-probability words next (most forgotten)
      3. Mix in one new word if available

    Returns list of word dicts with metadata.
    """
    progress = _load_progress()
    words_data = _load_words()
    word_lookup = {w["word"]: w for w in words_data}

    candidates = []
    new_words = []

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

    # Sort by recall probability ascending (most forgotten first)
    candidates.sort(key=lambda x: x["recall_probability"])

    selected = []

    # Reserve 1 slot for a new word if available
    new_slot = 1 if new_words else 0
    review_slots = count - new_slot

    # Fill review slots (most forgotten first)
    selected.extend(candidates[:review_slots])

    # Fill new word slot
    if new_words:
        # Prioritise easiest new words
        new_words.sort(key=lambda x: x["difficulty"])
        selected.append(new_words[0])

    # If we still don't have enough, pad with more new words or reviews
    if len(selected) < count:
        remaining_new = [w for w in new_words if w not in selected]
        remaining_review = [w for w in candidates if w not in selected]
        pool = remaining_new + remaining_review
        for item in pool:
            if len(selected) >= count:
                break
            selected.append(item)

    # If still short (e.g. very few words unlocked), just return what we have
    return selected[:count]


# ── Phrase selection ─────────────────────────────────────────────────────────

def get_next_phrase() -> dict | None:
    """Select the best phrase for melody practice using HLR."""
    progress = _load_progress()
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

    # Never-practiced first, then lowest recall probability
    candidates.sort(key=lambda x: (x["times_practiced"] > 0, x["recall_probability"]))
    return candidates[0]


# ── Record results ───────────────────────────────────────────────────────────

def record_word_result(word: str, score: int, phoneme_details: list[dict] | None = None):
    """
    Update progress for a word after practice.

    Args:
        word: The practiced word
        score: 0-100 accuracy score
        phoneme_details: Optional list of {phoneme, accuracy, status} dicts
    """
    progress = _load_progress()

    if word not in progress["words"]:
        return  # unknown word

    state = progress["words"][word]
    state["last_practiced"] = time.time()
    state["times_practiced"] += 1
    state["best_score"] = max(state["best_score"], score)

    # Update recent scores (keep last 10)
    state["recent_scores"].append(score)
    if len(state["recent_scores"]) > 10:
        state["recent_scores"] = state["recent_scores"][-10:]

    # Update half-life based on performance
    if score >= PASS_THRESHOLD:
        state["half_life"] = min(state["half_life"] * CORRECT_MULTIPLIER, MAX_HALF_LIFE)
        state["consecutive_bad"] = 0
    else:
        state["half_life"] = max(state["half_life"] / INCORRECT_DIVISOR, MIN_HALF_LIFE)
        state["consecutive_good"] = 0

    # Track advancement streak
    if score >= ADVANCE_THRESHOLD:
        state["consecutive_good"] += 1
    else:
        state["consecutive_good"] = 0

    # Track support streak
    if score < SUPPORT_THRESHOLD:
        state["consecutive_bad"] += 1
    else:
        state["consecutive_bad"] = 0

    # Per-phoneme tracking
    if phoneme_details:
        for ph in phoneme_details:
            ph_name = ph.get("phoneme", "")
            ph_acc = ph.get("accuracy", 0)
            if ph_name not in state["phoneme_scores"]:
                state["phoneme_scores"][ph_name] = []
            state["phoneme_scores"][ph_name].append(ph_acc)
            # Keep last 10
            if len(state["phoneme_scores"][ph_name]) > 10:
                state["phoneme_scores"][ph_name] = state["phoneme_scores"][ph_name][-10:]

    # Check for difficulty advancement
    _check_advancement(progress)

    _save_progress(progress)


def record_phrase_result(phrase_id: str, score: int):
    """Update progress for a melody phrase after practice."""
    progress = _load_progress()

    if phrase_id not in progress["phrases"]:
        return

    state = progress["phrases"][phrase_id]
    state["last_practiced"] = time.time()
    state["times_practiced"] += 1
    state["best_score"] = max(state["best_score"], score)

    state["recent_scores"].append(score)
    if len(state["recent_scores"]) > 10:
        state["recent_scores"] = state["recent_scores"][-10:]

    if score >= PASS_THRESHOLD:
        state["half_life"] = min(state["half_life"] * CORRECT_MULTIPLIER, MAX_HALF_LIFE)
        state["consecutive_bad"] = 0
    else:
        state["half_life"] = max(state["half_life"] / INCORRECT_DIVISOR, MIN_HALF_LIFE)
        state["consecutive_good"] = 0

    if score >= ADVANCE_THRESHOLD:
        state["consecutive_good"] += 1
    else:
        state["consecutive_good"] = 0

    if score < SUPPORT_THRESHOLD:
        state["consecutive_bad"] += 1
    else:
        state["consecutive_bad"] = 0

    # Unlock next-level phrases if advancement earned
    _check_phrase_advancement(progress)

    _save_progress(progress)


def record_session(session_type: str, scores: dict[str, int], duration_s: float = 0):
    """Record a completed practice session."""
    progress = _load_progress()
    progress["total_sessions"] += 1
    progress["total_practice_time_s"] += duration_s

    session_entry = {
        "timestamp": time.time(),
        "type": session_type,  # "assessment" or "melody"
        "scores": scores,
        "duration_s": duration_s,
    }
    progress["session_history"].append(session_entry)

    # Keep last 100 sessions
    if len(progress["session_history"]) > 100:
        progress["session_history"] = progress["session_history"][-100:]

    _save_progress(progress)


# ── Advancement logic ────────────────────────────────────────────────────────

def _check_advancement(progress: dict):
    """Unlock next-difficulty words when current difficulty is mastered."""
    current_diff = progress["current_difficulty"]

    # Count words at current difficulty with advancement streak
    words_at_level = [
        w for w in progress["words"].values()
        if w["difficulty"] == current_diff and w["unlocked"]
    ]

    if not words_at_level:
        return

    mastered = sum(1 for w in words_at_level if w["consecutive_good"] >= ADVANCE_STREAK)
    total = len(words_at_level)

    # If ≥60% of current level words are mastered, unlock next level
    if total > 0 and mastered / total >= 0.6:
        next_diff = current_diff + 1
        any_unlocked = False
        for word, state in progress["words"].items():
            if state["difficulty"] == next_diff and not state["unlocked"]:
                state["unlocked"] = True
                any_unlocked = True
        if any_unlocked:
            progress["current_difficulty"] = next_diff


def _check_phrase_advancement(progress: dict):
    """Unlock next-level phrases when current level phrases are mastered."""
    # Find max unlocked level
    unlocked_levels = set()
    for state in progress["phrases"].values():
        if state["unlocked"]:
            unlocked_levels.add(state["level"])

    if not unlocked_levels:
        return

    max_level = max(unlocked_levels)

    # Check if phrases at max_level have advancement streak
    phrases_at_level = [
        s for s in progress["phrases"].values()
        if s["level"] == max_level and s["unlocked"]
    ]

    mastered = sum(1 for s in phrases_at_level if s["consecutive_good"] >= ADVANCE_STREAK)
    total = len(phrases_at_level)

    if total > 0 and mastered / total >= 0.5:
        next_level = max_level + 1
        for phrase_id, state in progress["phrases"].items():
            if state["level"] == next_level and not state["unlocked"]:
                state["unlocked"] = True


# ── Stats & progress overview ────────────────────────────────────────────────

def get_progress_summary() -> dict[str, Any]:
    """Return a summary of overall progress for the frontend."""
    progress = _load_progress()
    words_data = _load_words()

    # Word stats
    total_words = len(progress["words"])
    unlocked_words = sum(1 for w in progress["words"].values() if w["unlocked"])
    practiced_words = sum(1 for w in progress["words"].values() if w["times_practiced"] > 0)
    mastered_words = sum(
        1 for w in progress["words"].values()
        if w["consecutive_good"] >= ADVANCE_STREAK
    )

    # Average score for practiced words
    all_recent = []
    for w in progress["words"].values():
        all_recent.extend(w["recent_scores"])
    avg_word_score = round(sum(all_recent) / len(all_recent)) if all_recent else 0

    # Phrase stats
    total_phrases = len(progress["phrases"])
    unlocked_phrases = sum(1 for p in progress["phrases"].values() if p["unlocked"])
    practiced_phrases = sum(1 for p in progress["phrases"].values() if p["times_practiced"] > 0)

    all_phrase_scores = []
    for p in progress["phrases"].values():
        all_phrase_scores.extend(p["recent_scores"])
    avg_phrase_score = round(sum(all_phrase_scores) / len(all_phrase_scores)) if all_phrase_scores else 0

    # Weakest phonemes across all words
    phoneme_avgs = {}
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

    # Difficulty breakdown
    diff_breakdown = {}
    for w in progress["words"].values():
        d = w["difficulty"]
        if d not in diff_breakdown:
            diff_breakdown[d] = {"total": 0, "unlocked": 0, "mastered": 0}
        diff_breakdown[d]["total"] += 1
        if w["unlocked"]:
            diff_breakdown[d]["unlocked"] += 1
        if w["consecutive_good"] >= ADVANCE_STREAK:
            diff_breakdown[d]["mastered"] += 1

    # Recent session history (last 10)
    recent_sessions = progress["session_history"][-10:]

    # Streak info
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
        "weak_phonemes": weak_phonemes[:5],  # top 5 weakest
        "difficulty_breakdown": diff_breakdown,
        "recent_sessions": recent_sessions,
    }


def _compute_streak(sessions: list[dict]) -> int:
    """Compute consecutive days of practice."""
    if not sessions:
        return 0

    # Get unique practice dates
    practice_dates = set()
    for s in sessions:
        ts = s.get("timestamp", 0)
        if ts > 0:
            day = time.strftime("%Y-%m-%d", time.localtime(ts))
            practice_dates.add(day)

    if not practice_dates:
        return 0

    # Check streak from today backwards
    today = time.strftime("%Y-%m-%d", time.localtime())
    streak = 0
    current = time.time()

    for i in range(365):  # max 1 year
        day = time.strftime("%Y-%m-%d", time.localtime(current - i * 86400))
        if day in practice_dates:
            streak += 1
        elif i == 0:
            continue  # today might not have a session yet
        else:
            break

    return streak


def get_word_details(word: str) -> dict | None:
    """Get detailed progress for a specific word."""
    progress = _load_progress()
    if word not in progress["words"]:
        return None

    state = progress["words"][word]
    p = _recall_probability(state["half_life"], state["last_practiced"])

    return {
        "word": word,
        "difficulty": state["difficulty"],
        "unlocked": state["unlocked"],
        "times_practiced": state["times_practiced"],
        "best_score": state["best_score"],
        "recent_scores": state["recent_scores"],
        "recall_probability": round(p, 3),
        "half_life_hours": round(state["half_life"] / 3600, 1),
        "consecutive_good": state["consecutive_good"],
        "consecutive_bad": state["consecutive_bad"],
        "phoneme_scores": {
            ph: round(sum(scores) / len(scores)) if scores else 0
            for ph, scores in state.get("phoneme_scores", {}).items()
        },
        "needs_support": state["consecutive_bad"] >= SUPPORT_STREAK,
        "mastered": state["consecutive_good"] >= ADVANCE_STREAK,
    }


def reset_progress():
    """Reset all progress (for testing / new patient)."""
    progress = _init_progress()
    return progress


# ── Daily Missions ───────────────────────────────────────────────────────────

def get_daily_missions() -> list[dict]:
    """
    Generate daily missions based on the patient's current progress.
    Missions refresh each calendar day and adapt to skill level.
    """
    progress = _load_progress()
    today = time.strftime("%Y-%m-%d", time.localtime())

    # Check if missions were already generated today
    cached = progress.get("missions", {})
    if cached.get("date") == today and cached.get("items"):
        return _refresh_mission_status(cached["items"], progress)

    missions = _generate_missions(progress)
    progress["missions"] = {"date": today, "items": missions}
    _save_progress(progress)
    return missions


def _generate_missions(progress: dict) -> list[dict]:
    """Build a set of 4-5 daily missions tailored to current progress."""
    missions = []
    mid = 0
    total_sessions = progress["total_sessions"]
    current_diff = progress["current_difficulty"]
    words_unlocked = sum(1 for w in progress["words"].values() if w["unlocked"])

    # ── Mission 1: Practice sessions ─────────────────────────────────────
    if total_sessions == 0:
        missions.append({"id": f"m{mid}", "title": "First Steps", "description": "Complete your first speech assessment", "type": "session", "target": 1, "icon": "🎯", "xp": 50})
    else:
        t = 2 if total_sessions < 10 else 3
        missions.append({"id": f"m{mid}", "title": "Daily Practice", "description": f"Complete {t} practice sessions today", "type": "session", "target": t, "icon": "📝", "xp": 30})
    mid += 1

    # ── Mission 2: Score-based ───────────────────────────────────────────
    weak_words = [(w, s) for w, s in progress["words"].items() if s["unlocked"] and s["times_practiced"] > 0 and s["recent_scores"] and sum(s["recent_scores"]) / len(s["recent_scores"]) < 80]
    if weak_words:
        tw = min(weak_words, key=lambda x: sum(x[1]["recent_scores"]) / len(x[1]["recent_scores"]))
        missions.append({"id": f"m{mid}", "title": "Improve a Weak Spot", "description": f"Score 80%+ on \"{tw[0]}\"", "type": "word_score", "target_word": tw[0], "target_score": 80, "icon": "💪", "xp": 40})
    else:
        missions.append({"id": f"m{mid}", "title": "High Score", "description": "Score 85%+ on any word", "type": "any_word_score", "target_score": 85, "icon": "⭐", "xp": 40})
    mid += 1

    # ── Mission 3: Exploration ───────────────────────────────────────────
    new_words = [w for w, s in progress["words"].items() if s["unlocked"] and s["times_practiced"] == 0]
    if new_words:
        missions.append({"id": f"m{mid}", "title": "Explorer", "description": "Practice a word you haven't tried yet", "type": "new_word", "target": 1, "icon": "🔍", "xp": 25})
    else:
        missions.append({"id": f"m{mid}", "title": "Review Champion", "description": "Practice 5 different words today", "type": "unique_words", "target": min(5, words_unlocked), "icon": "🏆", "xp": 35})
    mid += 1

    # ── Mission 4: Melody ────────────────────────────────────────────────
    missions.append({"id": f"m{mid}", "title": "Sing Along", "description": "Complete a melody therapy session", "type": "melody", "target": 1, "icon": "🎵", "xp": 30})
    mid += 1

    # ── Mission 5 (bonus): Challenge a harder word ───────────────────────
    challenge_words = [(w, s) for w, s in progress["words"].items() if not s["unlocked"] and s["difficulty"] == current_diff + 1]
    if challenge_words:
        missions.append({"id": f"m{mid}", "title": "Challenge Mode", "description": f"Try the advanced word \"{challenge_words[0][0]}\"", "type": "challenge", "target_word": challenge_words[0][0], "icon": "🔥", "xp": 60, "bonus": True})

    return _refresh_mission_status(missions, progress)


def _refresh_mission_status(missions: list[dict], progress: dict) -> list[dict]:
    """Update each mission's progress/completed fields from live data."""
    today_start = time.mktime(time.strptime(time.strftime("%Y-%m-%d", time.localtime()), "%Y-%m-%d"))
    today_sessions = [s for s in progress["session_history"] if s.get("timestamp", 0) >= today_start]
    today_melody = [s for s in today_sessions if s.get("type") == "melody"]
    words_today = set()
    word_best: dict[str, int] = {}
    for s in today_sessions:
        for w, score in s.get("scores", {}).items():
            words_today.add(w)
            word_best[w] = max(word_best.get(w, 0), score)

    for m in missions:
        mt = m["type"]
        if mt == "session":
            m["current"] = len(today_sessions)
            m["completed"] = m["current"] >= m["target"]
        elif mt == "word_score":
            best = word_best.get(m.get("target_word", ""), 0)
            m["current"] = best
            m["completed"] = best >= m.get("target_score", 80)
        elif mt == "any_word_score":
            best = max(word_best.values()) if word_best else 0
            m["current"] = best
            m["completed"] = best >= m.get("target_score", 85)
        elif mt == "new_word":
            new_count = sum(1 for w in words_today if progress["words"].get(w, {}).get("times_practiced", 0) <= 1)
            m["current"] = new_count
            m["completed"] = new_count >= m.get("target", 1)
        elif mt == "unique_words":
            m["current"] = len(words_today)
            m["completed"] = m["current"] >= m.get("target", 5)
        elif mt == "melody":
            m["current"] = len(today_melody)
            m["completed"] = m["current"] >= m.get("target", 1)
        elif mt == "challenge":
            m["current"] = 1 if m.get("target_word", "") in words_today else 0
            m["completed"] = m["current"] >= 1
    return missions


# ── Challenge Mode (browse all words by difficulty) ──────────────────────────

def get_all_words_by_difficulty() -> dict[str, Any]:
    """Return all words grouped by difficulty level, with progress status."""
    progress = _load_progress()
    words_data = _load_words()
    word_lookup = {w["word"]: w for w in words_data}
    levels: dict[int, list] = {}

    for word, state in progress["words"].items():
        diff = state["difficulty"]
        if diff not in levels:
            levels[diff] = []
        meta = word_lookup.get(word, {})
        p = _recall_probability(state["half_life"], state["last_practiced"])
        levels[diff].append({
            "word": word,
            "difficulty": diff,
            "category": meta.get("category", "daily"),
            "phonemes": meta.get("phonemes", []),
            "unlocked": state["unlocked"],
            "times_practiced": state["times_practiced"],
            "best_score": state["best_score"],
            "mastered": state["consecutive_good"] >= ADVANCE_STREAK,
            "recall_probability": round(p, 3),
        })

    for diff in levels:
        levels[diff].sort(key=lambda x: (x["mastered"], -x["best_score"]))

    return {
        "current_difficulty": progress["current_difficulty"],
        "levels": {str(k): v for k, v in sorted(levels.items())},
    }
