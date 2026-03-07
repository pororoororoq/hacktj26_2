import os
import subprocess
import tempfile

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

router = APIRouter()

FFMPEG = "/usr/local/bin/ffmpeg"


@router.get("/api/tts")
async def text_to_speech(text: str = Query(..., max_length=200)):
    """Generate speech audio from text using macOS say command."""
    aiff_path = None
    wav_path = None
    try:
        # Generate AIFF with macOS say
        aiff_fd, aiff_path = tempfile.mkstemp(suffix=".aiff")
        os.close(aiff_fd)
        subprocess.run(
            ["say", "-o", aiff_path, text],
            capture_output=True, timeout=10,
        )

        # Convert to WAV for cross-platform compatibility
        wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
        os.close(wav_fd)
        subprocess.run(
            [FFMPEG, "-y", "-i", aiff_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, timeout=10,
        )

        return FileResponse(
            wav_path,
            media_type="audio/wav",
            filename="tts.wav",
            background=None,  # don't delete before sending
        )
    finally:
        if aiff_path and os.path.exists(aiff_path):
            try:
                os.unlink(aiff_path)
            except OSError:
                pass
        # Note: wav_path cleanup happens after response is sent by FileResponse
