import axios from 'axios';
import { AssessmentResponse, PitchAnalysisResponse } from '../types';

// Toggle for demo insurance -- set to true if backend is unreachable
const USE_MOCK = false;

// Update this to your backend URL
const API_BASE = 'http://10.180.0.182:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Mock responses for demo insurance
const MOCK_ASSESS: AssessmentResponse = {
  overall_score: 72,
  word_results: [
    {
      word: 'water',
      score: 65,
      phonemes: [
        { phoneme: 'w', accuracy: 90, status: 'ok' },
        { phoneme: 'aa', accuracy: 40, status: 'weak', error_type: 'distortion' },
        { phoneme: 't', accuracy: 85, status: 'ok' },
        { phoneme: 'er', accuracy: 55, status: 'weak', error_type: 'substitution' },
      ],
    },
    {
      word: 'happy',
      score: 78,
      phonemes: [
        { phoneme: 'hh', accuracy: 70, status: 'ok' },
        { phoneme: 'ae', accuracy: 85, status: 'ok' },
        { phoneme: 'p', accuracy: 90, status: 'ok' },
        { phoneme: 'iy', accuracy: 65, status: 'ok' },
      ],
    },
    {
      word: 'morning',
      score: 58,
      phonemes: [
        { phoneme: 'm', accuracy: 80, status: 'ok' },
        { phoneme: 'ao', accuracy: 45, status: 'weak', error_type: 'substitution' },
        { phoneme: 'r', accuracy: 35, status: 'weak', error_type: 'distortion' },
        { phoneme: 'n', accuracy: 75, status: 'ok' },
        { phoneme: 'ih', accuracy: 60, status: 'ok' },
        { phoneme: 'ng', accuracy: 50, status: 'weak', error_type: 'distortion' },
      ],
    },
  ],
  weak_phonemes: ['aa', 'er', 'ao', 'r', 'ng'],
  recommendations: [
    "Practice vowel sounds, especially 'ah' and 'aw'",
    "Focus on 'r' sounds with tongue placement exercises",
    'Try humming exercises for nasal sounds',
  ],
};

const MOCK_PITCH: PitchAnalysisResponse = {
  alignment_score: 78,
  patient_pitch_contour: Array.from({ length: 100 }, (_, i) => ({
    time: i * 0.05,
    frequency: 220 + Math.sin(i * 0.3) * 40 + (Math.random() - 0.5) * 15,
  })),
  target_pitch_contour: Array.from({ length: 100 }, (_, i) => ({
    time: i * 0.05,
    frequency: 220 + Math.sin(i * 0.3) * 40,
  })),
  deviation_regions: [
    { start: 1.2, end: 1.8, avg_deviation_hz: 35, label: 'flat' },
    { start: 2.5, end: 3.0, avg_deviation_hz: 20, label: 'sharp' },
  ],
  feedback: 'Good overall pitch matching! Work on sustaining notes in the middle of the phrase.',
};

export async function assessSpeech(audioUris: string[], words: string[]): Promise<AssessmentResponse> {
  if (USE_MOCK) return MOCK_ASSESS;

  const formData = new FormData();
  words.forEach((word, i) => {
    formData.append(`word_${i}`, {
      uri: audioUris[i],
      name: `word_${i}.wav`,
      type: 'audio/wav',
    } as any);
  });
  formData.append('words', JSON.stringify(words));

  const response = await api.post<AssessmentResponse>('/api/assess', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function analyzePitch(audioUri: string, targetPhraseId: string): Promise<PitchAnalysisResponse> {
  if (USE_MOCK) return MOCK_PITCH;

  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: 'singing.wav',
    type: 'audio/wav',
  } as any);
  formData.append('target_phrase_id', targetPhraseId);

  const response = await api.post<PitchAnalysisResponse>('/api/analyze-pitch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export function getTtsUrl(text: string): string {
  return `${API_BASE}/api/tts?text=${encodeURIComponent(text)}`;
}

// ── Adaptive Learning API ───────────────────────────────────────────────────

export interface NextWord {
  word: string;
  recall_probability: number;
  times_practiced: number;
  best_score: number;
  difficulty: number;
  phonemes: string[];
  category: string;
}

export interface NextPhrase {
  phrase_id: string;
  text: string;
  level: number;
  recall_probability: number;
  times_practiced: number;
  best_score: number;
  duration: number;
}

export interface WeakPhoneme {
  phoneme: string;
  avg_accuracy: number;
}

export interface ProgressSummary {
  current_difficulty: number;
  total_sessions: number;
  total_practice_time_minutes: number;
  streak_days: number;
  words: {
    total: number;
    unlocked: number;
    practiced: number;
    mastered: number;
    avg_score: number;
  };
  phrases: {
    total: number;
    unlocked: number;
    practiced: number;
    avg_score: number;
  };
  weak_phonemes: WeakPhoneme[];
  difficulty_breakdown: Record<string, { total: number; unlocked: number; mastered: number }>;
  recent_sessions: any[];
}

export async function getNextWords(count: number = 3): Promise<NextWord[]> {
  const response = await api.get<{ words: NextWord[] }>('/api/next-words', {
    params: { count },
  });
  return response.data.words;
}

export async function getNextPhrase(): Promise<NextPhrase> {
  const response = await api.get<{ phrase: NextPhrase }>('/api/next-phrase');
  return response.data.phrase;
}

export async function getProgressSummary(): Promise<ProgressSummary> {
  const response = await api.get<ProgressSummary>('/api/progress');
  return response.data;
}

export async function recordWordResult(word: string, score: number, phonemeDetails?: any[]): Promise<void> {
  await api.post('/api/record-word', {
    word,
    score,
    phoneme_details: phonemeDetails || null,
  });
}

export async function recordPhraseResult(phraseId: string, score: number): Promise<void> {
  await api.post('/api/record-phrase', {
    phrase_id: phraseId,
    score,
  });
}

export async function recordSession(
  sessionType: 'assessment' | 'melody',
  scores: Record<string, number>,
  durationS: number = 0,
): Promise<void> {
  await api.post('/api/record-session', {
    session_type: sessionType,
    scores,
    duration_s: durationS,
  });
}

export async function resetProgress(): Promise<void> {
  await api.post('/api/reset-progress');
}

// ── Missions API ────────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: string;
  target?: number;
  target_word?: string;
  target_score?: number;
  icon: string;
  xp: number;
  bonus?: boolean;
  current?: number;
  completed?: boolean;
}

export async function getDailyMissions(): Promise<Mission[]> {
  const response = await api.get<{ missions: Mission[] }>('/api/missions');
  return response.data.missions;
}

// ── Challenge Mode API ──────────────────────────────────────────────────────

export interface ChallengeWord {
  word: string;
  difficulty: number;
  category: string;
  phonemes: string[];
  unlocked: boolean;
  times_practiced: number;
  best_score: number;
  mastered: boolean;
  recall_probability: number;
}

export interface ChallengeData {
  current_difficulty: number;
  levels: Record<string, ChallengeWord[]>;
}

export async function getChallengeWords(): Promise<ChallengeData> {
  const response = await api.get<ChallengeData>('/api/challenge-words');
  return response.data;
}
