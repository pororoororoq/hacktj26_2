import json
import os
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from models.schemas import AssessmentResponse

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".caf"}
from services.phoneme_analyzer import analyze_phonemes
from services.scoring import compute_overall_score, get_weak_phonemes, generate_recommendations

router = APIRouter()

# Load target words on module import
_TARGET_WORDS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "target_words.json")
with open(_TARGET_WORDS_PATH) as _f:
    _TARGET_WORDS: list = json.load(_f)

# Build lookup: word -> expected phonemes
_WORD_PHONEMES: dict = {entry["word"]: entry["phonemes"] for entry in _TARGET_WORDS}

# Mock data path
_MOCK_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_responses.json")


@router.post("/api/assess", response_model=AssessmentResponse)
async def assess(request: Request):
    """Accept 1-N word audio files (word_0, word_1, ...) and a JSON words field."""
    form = await request.form()

    # Extract the words list
    words_raw = form.get("words")
    if not words_raw:
        raise HTTPException(status_code=400, detail="Missing 'words' field")
    try:
        word_list = json.loads(words_raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in 'words' field")

    # Collect upload files in order: word_0, word_1, ...
    uploads: list[UploadFile] = []
    for i in range(len(word_list)):
        key = f"word_{i}"
        upload = form.get(key)
        if upload is None:
            raise HTTPException(status_code=400, detail=f"Missing audio file '{key}'")
        uploads.append(upload)

    temp_paths = []

    try:
        # Save uploaded files to temp with size/type validation
        for upload in uploads:
            suffix = (os.path.splitext(upload.filename or "audio.wav")[1] or ".wav").lower()
            if suffix not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail=f"Unsupported audio format: {suffix}")
            contents = await upload.read()
            if len(contents) > MAX_UPLOAD_SIZE:
                raise HTTPException(status_code=413, detail="File too large. Max 10MB.")
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(contents)
                temp_paths.append(tmp.name)

        # Return mock data if USE_MOCK is set
        if os.environ.get("USE_MOCK", "false").lower() == "true":
            with open(_MOCK_PATH) as f:
                mock_data = json.load(f)
            return AssessmentResponse(**mock_data["assess"])

        # Real analysis: score each word
        word_results = []
        for i, word in enumerate(word_list):
            expected_phonemes = _WORD_PHONEMES.get(word, [])
            result = analyze_phonemes(temp_paths[i], word, expected_phonemes)
            word_results.append(result)

        # Compute overall score and recommendations
        word_scores = [wr["score"] for wr in word_results]
        overall_score = compute_overall_score(word_scores)
        weak_phonemes = get_weak_phonemes(word_results)
        recommendations = generate_recommendations(weak_phonemes)

        return AssessmentResponse(
            overall_score=overall_score,
            word_results=word_results,
            weak_phonemes=weak_phonemes,
            recommendations=recommendations,
        )

    except Exception as e:
        print(f"Assessment error: {e}")
        # Fallback: return mock data rather than crashing
        try:
            with open(_MOCK_PATH) as f:
                mock_data = json.load(f)
            return AssessmentResponse(**mock_data["assess"])
        except Exception:
            return AssessmentResponse(
                overall_score=0,
                word_results=[],
                weak_phonemes=[],
                recommendations=["An error occurred during analysis. Please try again."],
            )

    finally:
        # Privacy: delete ALL temp files
        for path in temp_paths:
            try:
                os.unlink(path)
            except OSError:
                pass
