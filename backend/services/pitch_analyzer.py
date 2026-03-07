import json
import os
import subprocess
from typing import List, Dict

import librosa
import numpy as np

_TARGET_MELODIES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "target_melodies.json")

# Scoring — tuned so that moderate pitch errors produce realistic scores:
#   0 semitones avg → 100%    (perfect match)
#   2 semitones avg → 80%     (very good)
#   5 semitones avg → 50%     (mediocre)
#  10 semitones avg → 0%      (way off)
_DTW_SCALE = 10.0
_DEVIATION_THRESHOLD_ST = 1.5  # semitones threshold for flagging a region
_MIN_DEVIATION_DURATION = 0.25  # seconds


def _load_target_melodies() -> dict:
    with open(_TARGET_MELODIES_PATH) as f:
        return json.load(f)


def _find_ffmpeg() -> str:
    """Find ffmpeg binary."""
    for path in ["/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"]:
        if os.path.exists(path):
            return path
    return "ffmpeg"


def _load_audio(audio_path: str) -> np.ndarray:
    """Load audio as float32 numpy array at 16kHz mono using Homebrew ffmpeg."""
    ffmpeg = _find_ffmpeg()
    cmd = [
        ffmpeg, "-nostdin", "-threads", "0",
        "-i", audio_path,
        "-f", "s16le", "-ac", "1", "-acodec", "pcm_s16le", "-ar", "16000",
        "-",
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()}")
    audio = np.frombuffer(result.stdout, np.int16).flatten().astype(np.float32) / 32768.0
    return audio


def _trim_silence(audio: np.ndarray, sr: int = 16000, threshold_db: float = -35.0) -> np.ndarray:
    """Trim silence from start and end of audio using energy-based detection.

    Returns the trimmed audio with a small margin (~50ms) on each side.
    """
    frame_length = int(sr * 0.025)  # 25ms frames
    hop_length = int(sr * 0.010)    # 10ms hop

    # Compute RMS energy per frame
    rms = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop_length)[0]

    # Convert threshold from dB to linear
    threshold = 10 ** (threshold_db / 20)

    # Find frames above threshold
    voiced_frames = np.where(rms > threshold)[0]

    if len(voiced_frames) == 0:
        return audio  # No speech detected, return as-is

    start_frame = max(0, voiced_frames[0] - 5)  # ~50ms margin
    end_frame = min(len(rms) - 1, voiced_frames[-1] + 5)

    start_sample = start_frame * hop_length
    end_sample = min(len(audio), (end_frame + 1) * hop_length)

    return audio[start_sample:end_sample]


def _hz_to_semitones(freqs: np.ndarray) -> np.ndarray:
    """Convert Hz to semitones relative to the mean pitch (removes absolute pitch)."""
    valid = freqs[freqs > 0]
    if len(valid) == 0:
        return np.zeros_like(freqs)
    ref = np.median(valid)
    # Avoid log(0)
    safe_freqs = np.maximum(freqs, 1.0)
    return 12 * np.log2(safe_freqs / ref)


def _extract_pitch(audio: np.ndarray, sr: int = 16000) -> List[Dict[str, float]]:
    """Extract voiced F0 pitch from audio numpy array using librosa pyin."""
    f0, voiced_flag, _ = librosa.pyin(audio, fmin=75.0, fmax=500.0, sr=sr, frame_length=2048)
    hop_length = 512
    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)
    points = []
    for t, f, v in zip(times, f0, voiced_flag):
        if v and f is not None and not np.isnan(f) and f > 0:
            points.append({"time": float(t), "frequency": float(f)})
    return points


def _dtw_distance(seq_a: np.ndarray, seq_b: np.ndarray) -> float:
    """Simple O(N*M) DTW on 1-D sequences. Returns normalized cost."""
    n = len(seq_a)
    m = len(seq_b)
    cost = np.full((n, m), np.inf)
    cost[0, 0] = abs(seq_a[0] - seq_b[0])
    for i in range(1, n):
        cost[i, 0] = cost[i - 1, 0] + abs(seq_a[i] - seq_b[0])
    for j in range(1, m):
        cost[0, j] = cost[0, j - 1] + abs(seq_a[0] - seq_b[j])
    for i in range(1, n):
        for j in range(1, m):
            cost[i, j] = abs(seq_a[i] - seq_b[j]) + min(
                cost[i - 1, j],
                cost[i, j - 1],
                cost[i - 1, j - 1],
            )
    return float(cost[n - 1, m - 1]) / (n + m)


def _find_deviation_regions(
    patient_st: np.ndarray,
    target_st: np.ndarray,
    patient_times: np.ndarray,
    target_times: np.ndarray,
) -> List[Dict]:
    """Find regions where patient pitch deviates from target (in semitones)."""
    if len(patient_st) == 0 or len(target_st) == 0:
        return []

    # Resample target semitones onto patient time axis
    target_interp = np.interp(
        np.linspace(0, 1, len(patient_st)),
        np.linspace(0, 1, len(target_st)),
        target_st,
    )

    regions = []
    region_start = None
    region_deviations = []

    for i, (p_st, t_st) in enumerate(zip(patient_st, target_interp)):
        t = float(patient_times[i]) if i < len(patient_times) else i * 0.01
        deviation_st = p_st - t_st  # positive = sharp, negative = flat

        if abs(deviation_st) > _DEVIATION_THRESHOLD_ST:
            if region_start is None:
                region_start = t
                region_deviations = [deviation_st]
            else:
                region_deviations.append(deviation_st)
        else:
            if region_start is not None:
                duration = t - region_start
                if duration >= _MIN_DEVIATION_DURATION:
                    avg_dev = float(np.mean(region_deviations))
                    label = "sharp" if avg_dev > 0 else "flat"
                    regions.append({
                        "start": region_start,
                        "end": t,
                        "avg_deviation_hz": abs(avg_dev) * 10,  # rough st->hz for display
                        "label": label,
                    })
                region_start = None
                region_deviations = []

    # Close any open region
    if region_start is not None and region_deviations:
        t = float(patient_times[-1]) if len(patient_times) > 0 else region_start + 0.5
        duration = t - region_start
        if duration >= _MIN_DEVIATION_DURATION:
            avg_dev = float(np.mean(region_deviations))
            label = "sharp" if avg_dev > 0 else "flat"
            regions.append({
                "start": region_start,
                "end": t,
                "avg_deviation_hz": abs(avg_dev) * 10,
                "label": label,
            })

    return regions


def _generate_feedback(alignment_score: int, deviation_regions: List[Dict]) -> str:
    if not deviation_regions:
        if alignment_score >= 80:
            return "Excellent pitch matching! Keep it up."
        elif alignment_score >= 60:
            return "Good effort! Your melody is close — try to sustain each note a bit longer."
        else:
            return "Nice try! Focus on following the rise and fall of the melody more closely."

    flat_regions = [r for r in deviation_regions if r["label"] == "flat"]
    sharp_regions = [r for r in deviation_regions if r["label"] == "sharp"]

    if flat_regions and sharp_regions:
        return (
            "Your pitch drifts both high and low in places. "
            "Try to follow the melody more evenly — listen carefully and match each rise and fall."
        )
    elif flat_regions:
        return (
            "You're singing a bit flat in some areas. "
            "Try to vary your pitch more and aim higher in those sections."
        )
    elif sharp_regions:
        return (
            "You're going a bit high in some areas — try matching the melody lower "
            "and focus on the downward parts of the phrase."
        )
    return "Good effort! Keep practicing to improve your pitch matching."


def analyze_pitch(audio_path: str, target_phrase_id: str) -> dict:
    """Compare patient pitch to target melody using relative pitch (semitones)."""

    # Load target melody
    try:
        melodies = _load_target_melodies()
    except Exception as e:
        return _error_response(f"Could not load target melodies: {e}")

    if target_phrase_id not in melodies:
        return _error_response(f"Unknown target_phrase_id: {target_phrase_id}")

    target_data = melodies[target_phrase_id]
    target_contour = target_data["pitch_contour"]
    target_freqs = np.array([p["frequency"] for p in target_contour])
    target_times = np.array([p["time"] for p in target_contour])

    # Load and trim patient audio
    try:
        audio = _load_audio(audio_path)
        print(f"  Pitch: loaded {len(audio)/16000:.2f}s audio")
        audio = _trim_silence(audio)
        print(f"  Pitch: trimmed to {len(audio)/16000:.2f}s")
    except Exception as e:
        return _error_response(f"Audio load failed: {e}")

    # Extract patient pitch from trimmed audio
    try:
        patient_points = _extract_pitch(audio)
    except Exception as e:
        return _error_response(f"Pitch extraction failed: {e}")

    if len(patient_points) < 3:
        return {
            "alignment_score": 0,
            "patient_pitch_contour": patient_points,
            "target_pitch_contour": target_contour,
            "deviation_regions": [],
            "feedback": "No voiced pitch detected. Please try again in a quieter environment and speak clearly.",
        }

    patient_freqs = np.array([p["frequency"] for p in patient_points])
    patient_times = np.array([p["time"] for p in patient_points])

    print(f"  Pitch: patient range {patient_freqs.min():.0f}-{patient_freqs.max():.0f} Hz, "
          f"target range {target_freqs.min():.0f}-{target_freqs.max():.0f} Hz")

    # Convert both to semitones (relative pitch — removes absolute pitch difference)
    target_st = _hz_to_semitones(target_freqs)
    patient_st = _hz_to_semitones(patient_freqs)

    # Resample target to same length as patient for DTW
    target_resampled = np.interp(
        np.linspace(0, 1, len(patient_st)),
        np.linspace(0, 1, len(target_st)),
        target_st,
    )

    try:
        dtw_cost = _dtw_distance(patient_st, target_resampled)
    except Exception:
        dtw_cost = 25.0

    # Score: 100 at cost=0, 0 at cost=25 semitones
    alignment_score = int(max(0, min(100, 100 - dtw_cost * _DTW_SCALE)))
    print(f"  Pitch: DTW cost={dtw_cost:.2f} semitones, score={alignment_score}%")

    # Deviation regions (in semitones)
    deviation_regions = _find_deviation_regions(patient_st, target_st, patient_times, target_times)

    # Feedback
    feedback = _generate_feedback(alignment_score, deviation_regions)

    return {
        "alignment_score": alignment_score,
        "patient_pitch_contour": patient_points,
        "target_pitch_contour": target_contour,
        "deviation_regions": [
            {
                "start": float(r["start"]),
                "end": float(r["end"]),
                "avg_deviation_hz": float(r["avg_deviation_hz"]),
                "label": r["label"],
            }
            for r in deviation_regions
        ],
        "feedback": feedback,
    }


def _error_response(message: str) -> dict:
    """Return a safe fallback response on error."""
    return {
        "alignment_score": 0,
        "patient_pitch_contour": [],
        "target_pitch_contour": [],
        "deviation_regions": [],
        "feedback": message,
    }
