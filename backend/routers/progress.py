"""
Progress & Adaptive Learning API endpoints.

Provides:
  - GET  /api/progress          → overall progress summary
  - GET  /api/next-words        → HLR-selected words for next session
  - GET  /api/next-phrase       → HLR-selected phrase for melody practice
  - POST /api/record-word       → record word practice result
  - POST /api/record-phrase     → record phrase practice result
  - POST /api/record-session    → record completed session
  - GET  /api/word-details/:w   → detailed progress for one word
  - POST /api/reset-progress    → reset all progress (dev/testing)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.learning_engine import (
    get_next_words,
    get_next_phrase,
    record_word_result,
    record_phrase_result,
    record_session,
    get_progress_summary,
    get_word_details,
    reset_progress,
    get_daily_missions,
    get_all_words_by_difficulty,
)

router = APIRouter()


# ── Request / Response models ────────────────────────────────────────────────

class RecordWordRequest(BaseModel):
    word: str
    score: int
    phoneme_details: Optional[list[dict]] = None


class RecordPhraseRequest(BaseModel):
    phrase_id: str
    score: int


class RecordSessionRequest(BaseModel):
    session_type: str  # "assessment" or "melody"
    scores: dict[str, int]
    duration_s: float = 0


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/api/progress")
def progress_summary():
    """Get overall progress summary with stats, streaks, and weak areas."""
    return get_progress_summary()


@router.get("/api/next-words")
def next_words(count: int = 3):
    """Get the next words to practice, selected by HLR algorithm."""
    words = get_next_words(count)
    return {"words": words}


@router.get("/api/next-phrase")
def next_phrase():
    """Get the next phrase for melody therapy, selected by HLR algorithm."""
    phrase = get_next_phrase()
    if phrase is None:
        raise HTTPException(status_code=404, detail="No phrases available")
    return {"phrase": phrase}


@router.post("/api/record-word")
def record_word(req: RecordWordRequest):
    """Record a word practice result and update HLR half-life."""
    record_word_result(req.word, req.score, req.phoneme_details)
    return {"status": "ok", "word": req.word, "score": req.score}


@router.post("/api/record-phrase")
def record_phrase(req: RecordPhraseRequest):
    """Record a melody phrase result and update HLR half-life."""
    record_phrase_result(req.phrase_id, req.score)
    return {"status": "ok", "phrase_id": req.phrase_id, "score": req.score}


@router.post("/api/record-session")
def session_record(req: RecordSessionRequest):
    """Record a completed practice session."""
    record_session(req.session_type, req.scores, req.duration_s)
    return {"status": "ok"}


@router.get("/api/word-details/{word}")
def word_details(word: str):
    """Get detailed progress for a specific word."""
    details = get_word_details(word)
    if details is None:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not found")
    return details


@router.post("/api/reset-progress")
def reset():
    """Reset all progress data (for testing / new patient)."""
    reset_progress()
    return {"status": "ok", "message": "Progress reset successfully"}


@router.get("/api/missions")
def missions():
    """Get today's daily missions with completion status."""
    return {"missions": get_daily_missions()}


@router.get("/api/challenge-words")
def challenge_words():
    """Get all words grouped by difficulty for challenge mode."""
    return get_all_words_by_difficulty()
