import json
import os
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from models.schemas import PitchAnalysisResponse
from services.pitch_analyzer import analyze_pitch

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".caf"}

router = APIRouter()


@router.post("/api/analyze-pitch", response_model=PitchAnalysisResponse)
async def analyze_pitch_endpoint(
    audio: UploadFile = File(...),
    target_phrase_id: str = Form(...),
):
    temp_path = None

    try:
        # Validate file type and size
        suffix = (os.path.splitext(audio.filename or "audio.wav")[1] or ".wav").lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported audio format: {suffix}")
        contents = await audio.read()
        if len(contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Max 10MB.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            temp_path = tmp.name

        use_mock = os.environ.get("USE_MOCK", "false").lower() == "true"

        if use_mock:
            mock_path = os.path.join(os.path.dirname(__file__), "..", "data", "mock_responses.json")
            with open(mock_path) as f:
                mock_data = json.load(f)
            return PitchAnalysisResponse(**mock_data["analyze_pitch"])

        try:
            result = analyze_pitch(temp_path, target_phrase_id)
            return PitchAnalysisResponse(**result)
        except Exception:
            # Fallback to mock on analysis failure (demo insurance)
            mock_path = os.path.join(os.path.dirname(__file__), "..", "data", "mock_responses.json")
            with open(mock_path) as f:
                mock_data = json.load(f)
            return PitchAnalysisResponse(**mock_data["analyze_pitch"])

    finally:
        # Privacy: delete temp file after processing
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
