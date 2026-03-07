export interface PhonemeResult {
  phoneme: string;
  accuracy: number;
  status: 'ok' | 'weak';
  error_type?: 'substitution' | 'distortion' | 'omission';
}

export interface WordResult {
  word: string;
  score: number;
  phonemes: PhonemeResult[];
}

export interface AssessmentResponse {
  overall_score: number;
  word_results: WordResult[];
  weak_phonemes: string[];
  recommendations: string[];
}

export interface PitchPoint {
  time: number;
  frequency: number;
}

export interface DeviationRegion {
  start: number;
  end: number;
  avg_deviation_hz: number;
  label: string;
}

export interface PitchAnalysisResponse {
  alignment_score: number;
  patient_pitch_contour: PitchPoint[];
  target_pitch_contour: PitchPoint[];
  deviation_regions: DeviationRegion[];
  feedback: string;
}

export interface SessionResults {
  assessmentScore: number;
  pitchScore: number;
  overallScore: number;
  wordResults: WordResult[];
  weakPhonemes: string[];
  recommendations: string[];
  pitchFeedback: string;
}
