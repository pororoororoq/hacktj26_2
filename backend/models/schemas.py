from pydantic import BaseModel
from typing import List, Optional


class PhonemeResult(BaseModel):
    phoneme: str
    accuracy: int
    status: str  # "ok" or "weak"
    error_type: Optional[str] = None  # "substitution", "distortion", "omission"


class WordResult(BaseModel):
    word: str
    score: int
    phonemes: List[PhonemeResult]


class AssessmentResponse(BaseModel):
    overall_score: int
    word_results: List[WordResult]
    weak_phonemes: List[str]
    recommendations: List[str]


class PitchPoint(BaseModel):
    time: float
    frequency: float


class DeviationRegion(BaseModel):
    start: float
    end: float
    avg_deviation_hz: float
    label: str


class PitchAnalysisResponse(BaseModel):
    alignment_score: int
    patient_pitch_contour: List[PitchPoint]
    target_pitch_contour: List[PitchPoint]
    deviation_regions: List[DeviationRegion]
    feedback: str
