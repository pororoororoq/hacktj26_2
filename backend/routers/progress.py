"""
Progress & Adaptive Learning API endpoints.

All endpoints require a valid Bearer token (Authorization header).
user_id is extracted from the token via get_current_user dependency.

Endpoints:
  GET  /api/progress                       overall progress summary
  GET  /api/progress/history?days=30       session score history + weekly activity
  GET  /api/progress/phoneme-history       per-phoneme accuracy + trends
  GET  /api/progress/syllable-report       syllable position/shape heatmap + suggestions
  GET  /api/next-words                  HLR-selected words for next session
  GET  /api/next-phrase                 HLR-selected phrase for melody practice
  POST /api/record-word                 record word practice result
  POST /api/record-phrase               record phrase practice result
  POST /api/record-session              record completed session
  GET  /api/word-details/:w             detailed progress for one word
  POST /api/reset-progress              reset all progress (dev/testing)
  GET  /api/missions                    today's daily missions
  GET  /api/challenge-words             all words grouped by difficulty
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from routers.auth import get_current_user
from services.learning_engine import (
    get_next_words,
    get_next_phrase,
    record_word_result,
    record_phrase_result,
    record_session,
    get_progress_summary,
    get_progress_history,
    get_phoneme_history,
    get_syllable_report,
    get_word_details,
    reset_progress,
    get_daily_missions,
    get_all_words_by_difficulty,
)

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────────────

class RecordWordRequest(BaseModel):
    word: str
    score: int
    phoneme_details: Optional[list[dict]] = None


class RecordPhraseRequest(BaseModel):
    phrase_id: str
    score: int


class RecordSessionRequest(BaseModel):
    session_type: str   # "assessment" or "melody"
    scores: dict[str, int]
    duration_s: float = 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/progress")
def progress_summary(user_id: int = Depends(get_current_user)):
    return get_progress_summary(user_id)


@router.get("/api/progress/history")
def progress_history(days: int = 30, user_id: int = Depends(get_current_user)):
    """Session score history (line chart) + 7-day activity (bar chart)."""
    return get_progress_history(days, user_id)


@router.get("/api/progress/phoneme-history")
def phoneme_history(user_id: int = Depends(get_current_user)):
    """Per-phoneme accuracy averages and trends for the heatmap."""
    return get_phoneme_history(user_id)


@router.get("/api/progress/syllable-report")
def syllable_report(user_id: int = Depends(get_current_user)):
    """Syllable position/shape accuracy heatmap + actionable focus suggestions."""
    return get_syllable_report(user_id)


@router.get("/api/next-words")
def next_words(count: int = 3, user_id: int = Depends(get_current_user)):
    words = get_next_words(count, user_id)
    return {"words": words}


@router.get("/api/next-phrase")
def next_phrase(user_id: int = Depends(get_current_user)):
    phrase = get_next_phrase(user_id)
    if phrase is None:
        raise HTTPException(status_code=404, detail="No phrases available")
    return {"phrase": phrase}


@router.post("/api/record-word")
def record_word(req: RecordWordRequest, user_id: int = Depends(get_current_user)):
    record_word_result(req.word, req.score, req.phoneme_details, user_id)
    return {"status": "ok", "word": req.word, "score": req.score}


@router.post("/api/record-phrase")
def record_phrase(req: RecordPhraseRequest, user_id: int = Depends(get_current_user)):
    record_phrase_result(req.phrase_id, req.score, user_id)
    return {"status": "ok", "phrase_id": req.phrase_id, "score": req.score}


@router.post("/api/record-session")
def session_record(req: RecordSessionRequest, user_id: int = Depends(get_current_user)):
    record_session(req.session_type, req.scores, req.duration_s, user_id)
    return {"status": "ok"}


@router.get("/api/word-details/{word}")
def word_details(word: str, user_id: int = Depends(get_current_user)):
    details = get_word_details(word, user_id)
    if details is None:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not found")
    return details


@router.post("/api/reset-progress")
def reset(user_id: int = Depends(get_current_user)):
    reset_progress(user_id)
    return {"status": "ok", "message": "Progress reset successfully"}


@router.get("/api/missions")
def missions(user_id: int = Depends(get_current_user)):
    return {"missions": get_daily_missions(user_id)}


@router.get("/api/challenge-words")
def challenge_words(user_id: int = Depends(get_current_user)):
    return get_all_words_by_difficulty(user_id)
