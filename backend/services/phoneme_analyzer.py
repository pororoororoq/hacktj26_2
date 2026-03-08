import whisper
import numpy as np
import os
import subprocess
from g2p_en import G2p

# Load models once at import
print("Loading Whisper model...")
_model = whisper.load_model("base")
print("Whisper model loaded.")
_g2p = G2p()


def _find_ffmpeg() -> str:
    """Find ffmpeg binary."""
    for path in ["/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"]:
        if os.path.exists(path):
            return path
    return "ffmpeg"


def _load_audio(audio_path: str) -> np.ndarray:
    """Load audio file as float32 numpy array at 16kHz mono using Homebrew ffmpeg.

    This bypasses Whisper's internal load_audio which uses bare 'ffmpeg'
    (broken in anaconda). We use our known-good Homebrew ffmpeg instead.
    """
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


def _strip_stress(phoneme: str) -> str:
    """Remove stress markers (0,1,2) from ARPABET phonemes for comparison."""
    return phoneme.rstrip("012")


def _word_to_phonemes(word: str) -> list:
    """Convert a word to ARPABET phonemes using g2p_en."""
    raw = _g2p(word)
    # Filter out spaces and empty strings
    return [p for p in raw if p.strip()]


def _align_phonemes(target_ph: list, heard_ph: list) -> list:
    """Align two phoneme sequences using edit distance with backtrace.

    Returns list of (target_phoneme, heard_phoneme) pairs.
    None means insertion/deletion.
    """
    m, n = len(target_ph), len(heard_ph)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if _strip_stress(target_ph[i - 1]) == _strip_stress(heard_ph[j - 1]) else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)

    # Backtrace to get alignment
    alignment = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            cost = 0 if _strip_stress(target_ph[i - 1]) == _strip_stress(heard_ph[j - 1]) else 1
            if dp[i][j] == dp[i - 1][j - 1] + cost:
                alignment.append((target_ph[i - 1], heard_ph[j - 1]))
                i -= 1
                j -= 1
                continue
        if i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            alignment.append((target_ph[i - 1], None))  # deletion
            i -= 1
        elif j > 0 and dp[i][j] == dp[i][j - 1] + 1:
            alignment.append((None, heard_ph[j - 1]))  # insertion
            j -= 1
        else:
            break

    alignment.reverse()
    return alignment


def _phoneme_similarity(target_ph: str, heard_ph: str) -> int:
    """Score similarity between two ARPABET phonemes (0-100).

    - Exact match (ignoring stress): 100
    - Same manner class (both vowels, both stops, etc.): 60
    - Different classes: 30
    - One is None (omission/insertion): 0
    """
    if target_ph is None or heard_ph is None:
        return 0

    t = _strip_stress(target_ph)
    h = _strip_stress(heard_ph)

    if t == h:
        return 100

    # Vowels
    vowels = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"}
    # Stops
    stops = {"B", "D", "G", "K", "P", "T"}
    # Fricatives
    fricatives = {"CH", "DH", "F", "JH", "S", "SH", "TH", "V", "Z", "ZH"}
    # Nasals
    nasals = {"M", "N", "NG"}
    # Liquids/glides
    liquids = {"L", "R", "W", "Y", "HH"}

    classes = [vowels, stops, fricatives, nasals, liquids]
    for cls in classes:
        if t in cls and h in cls:
            return 60

    return 30


def _map_alignment_to_expected(alignment: list, expected_phonemes: list, target_phonemes: list) -> list:
    """Map g2p alignment results back to the frontend's expected_phonemes.

    The frontend sends phonemes like ['W', 'AH', 'T', 'ER'] and g2p produces
    ['W', 'AO1', 'T', 'ER0']. We map by proportional position.
    """
    # Get per-target-phoneme scores from alignment
    target_scores = []
    for t_ph, h_ph in alignment:
        if t_ph is not None:
            target_scores.append(_phoneme_similarity(t_ph, h_ph))

    if not target_scores:
        return [50] * len(expected_phonemes)

    # Map target_scores (from g2p phonemes) proportionally to expected_phonemes
    n_expected = len(expected_phonemes)
    n_target = len(target_scores)
    result_scores = []

    for i in range(n_expected):
        # Proportional mapping
        start = int(i * n_target / n_expected)
        end = max(start + 1, int((i + 1) * n_target / n_expected))
        segment = target_scores[start:end]
        result_scores.append(int(sum(segment) / len(segment)) if segment else 50)

    return result_scores


def _audio_has_speech(audio: np.ndarray, sr: int = 16000, threshold_db: float = -40.0) -> bool:
    """Check if audio contains enough energy to be actual speech.

    Returns False for silence / near-silence recordings.
    """
    if len(audio) < sr * 0.3:  # less than 0.3s
        return False
    # RMS energy in dB
    rms = np.sqrt(np.mean(audio ** 2))
    if rms < 1e-6:
        return False
    db = 20 * np.log10(rms)
    return db > threshold_db


def _is_multi_word(text: str) -> bool:
    """Check if the target is a sentence/phrase (multiple words)."""
    return len(text.split()) > 1


def _phrase_to_phonemes(phrase: str) -> list:
    """Convert a multi-word phrase to ARPABET phonemes, word by word."""
    phonemes = []
    for w in phrase.split():
        w = w.strip()
        if w:
            phonemes.extend(_word_to_phonemes(w))
    return phonemes


def analyze_phonemes(audio_path: str, word: str, expected_phonemes: list) -> dict:
    """Analyze pronunciation using Whisper AI + g2p phoneme comparison."""
    try:
        audio = _load_audio(audio_path)
        target = word.lower().strip()
        is_phrase = _is_multi_word(target)
        target_word_count = len(target.split())

        # ── Silence gate: reject recordings with no real speech ──────────
        if not _audio_has_speech(audio):
            print(f"  Silent/near-silent recording for '{target}'")
            return _empty_result(word, expected_phonemes, "omission")

        # Pass 1: Whisper WITHOUT hints for honest transcription
        result_raw = _model.transcribe(
            audio, language="en", fp16=False, temperature=0,
            condition_on_previous_text=False,
        )
        raw_text = result_raw["text"].strip().lower()
        raw_clean = "".join(c for c in raw_text if c.isalnum() or c == " ").strip()

        # Pass 2: Whisper WITH hint for reliability (catches cases where pass 1 fails)
        result_hint = _model.transcribe(
            audio, language="en", fp16=False, temperature=0,
            initial_prompt=f"{target}.",
            condition_on_previous_text=False,
        )
        hint_text = result_hint["text"].strip().lower()
        hint_clean = "".join(c for c in hint_text if c.isalnum() or c == " ").strip()

        # Guard against hallucination — scale limit by target word count
        max_words = max(3, target_word_count * 3)
        if len(raw_clean.split()) > max_words:
            raw_clean = " ".join(raw_clean.split()[:max_words])
        if len(hint_clean.split()) > max_words:
            hint_clean = " ".join(hint_clean.split()[:max_words])

        # ── Transcription selection ──────────────────────────────────────
        # If raw pass heard nothing, the hinted pass likely hallucinated
        # the target word from the prompt. Don't trust it.
        if not raw_clean and hint_clean:
            # Check if the hint just echoed back the target (hallucination)
            hint_similarity = _char_accuracy(target, hint_clean)
            if hint_similarity > 85:
                print(f"  Hint likely hallucinated target (similarity={hint_similarity:.0f}%), treating as silence")
                return _empty_result(word, expected_phonemes, "omission")

        # Prefer raw (honest), fall back to hint only if raw is empty
        transcribed = raw_clean if raw_clean else hint_clean

        print(f"  Whisper raw: '{raw_clean}', hint: '{hint_clean}' (target: '{target}')")

        if not transcribed:
            return _empty_result(word, expected_phonemes, "omission")

        if is_phrase:
            # For sentences/phrases: use the full transcription, pick best
            # contiguous subsequence matching target word count
            heard_text = transcribed
            t_words = transcribed.split()
            if len(t_words) > target_word_count:
                # Slide a window of target_word_count over transcription, pick best
                best_score = -1
                best_subseq = transcribed
                for start in range(len(t_words) - target_word_count + 1):
                    candidate = " ".join(t_words[start:start + target_word_count])
                    sc = _char_accuracy(target, candidate)
                    if sc > best_score:
                        best_score = sc
                        best_subseq = candidate
                heard_text = best_subseq
            # Convert phrase to phonemes word-by-word
            target_phonemes = _phrase_to_phonemes(target)
            heard_phonemes = _phrase_to_phonemes(heard_text)
        else:
            # For single words: pick the single best-matching word
            best_word = transcribed
            words = transcribed.split()
            if len(words) > 1:
                best_word = max(words, key=lambda w: _char_accuracy(target, w))
            target_phonemes = _word_to_phonemes(target)
            heard_phonemes = _word_to_phonemes(best_word)

        print(f"  Target phonemes: {target_phonemes}")
        print(f"  Heard phonemes:  {heard_phonemes}")

        # Align phoneme sequences
        alignment = _align_phonemes(target_phonemes, heard_phonemes)

        # Overall score from phoneme alignment
        if alignment:
            scores = [_phoneme_similarity(t, h) for t, h in alignment]
            word_score = int(sum(scores) / len(scores))
        else:
            word_score = 0

        # Map alignment scores to frontend's expected_phonemes
        per_phoneme_scores = _map_alignment_to_expected(alignment, expected_phonemes, target_phonemes)

        phoneme_results = []
        for i, phoneme in enumerate(expected_phonemes):
            score = per_phoneme_scores[i] if i < len(per_phoneme_scores) else word_score
            status = "ok" if score >= 60 else "weak"
            res = {"phoneme": phoneme, "accuracy": score, "status": status}
            if status == "weak":
                if score < 20:
                    res["error_type"] = "omission"
                elif score < 40:
                    res["error_type"] = "substitution"
                else:
                    res["error_type"] = "distortion"
            phoneme_results.append(res)

        return {
            "word": word,
            "score": word_score,
            "phonemes": phoneme_results,
        }

    except Exception as e:
        import traceback
        print(f"ERROR analyzing '{word}': {e}")
        traceback.print_exc()
        return _fallback_result(word, expected_phonemes)


def _char_accuracy(target: str, transcribed: str) -> float:
    """Score 0-100 based on character-level edit distance."""
    if not target:
        return 0
    m, n = len(target), len(transcribed)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if target[i - 1] == transcribed[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    dist = dp[m][n]
    max_len = max(m, n, 1)
    return max(0, min(100, (1 - dist / max_len) * 100))


def _empty_result(word: str, phonemes: list, error_type: str) -> dict:
    """Return result for empty/silent recording."""
    return {
        "word": word,
        "score": 15,
        "phonemes": [
            {"phoneme": p, "accuracy": 15, "status": "weak", "error_type": error_type}
            for p in phonemes
        ],
    }


def _fallback_result(word: str, phonemes: list) -> dict:
    """Return a neutral fallback result if analysis fails."""
    return {
        "word": word,
        "score": 50,
        "phonemes": [
            {"phoneme": p, "accuracy": 50, "status": "weak", "error_type": "distortion"}
            for p in phonemes
        ],
    }
