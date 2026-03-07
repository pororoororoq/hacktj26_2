def compute_overall_score(word_scores: list) -> int:
    """Compute weighted overall score from individual word scores."""
    if not word_scores:
        return 0
    return int(sum(word_scores) / len(word_scores))


def get_weak_phonemes(word_results: list) -> list:
    """Extract unique weak phonemes across all words."""
    weak = set()
    for wr in word_results:
        for p in wr.get("phonemes", []):
            if p.get("status") == "weak":
                weak.add(p["phoneme"])
    return sorted(list(weak))


def generate_recommendations(weak_phonemes: list) -> list:
    """Generate practice recommendations based on weak phonemes."""
    recs = []

    vowel_weak = [p for p in weak_phonemes if p in ("aa", "ae", "ao", "er", "iy", "ih", "ey", "ax")]
    consonant_weak = [p for p in weak_phonemes if p not in vowel_weak]

    if vowel_weak:
        vowel_names = ", ".join(f"/{v}/" for v in vowel_weak)
        recs.append(f"Practice vowel sounds: {vowel_names}. Try prolonging each sound for 3 seconds.")

    if "r" in consonant_weak:
        recs.append("Focus on 'r' sounds: curl your tongue tip slightly upward and back.")

    nasals = [p for p in consonant_weak if p in ("m", "n", "ng")]
    if nasals:
        recs.append("Try humming exercises for nasal sounds. Hum 'mmm' then open to 'mah'.")

    stops = [p for p in consonant_weak if p in ("p", "t", "b")]
    if stops:
        recs.append("Practice stop sounds with exaggerated lip/tongue placement. Say 'pa-pa-pa' slowly.")

    if not recs:
        recs.append("Great job! Continue practicing with varied phrases to maintain progress.")

    return recs
