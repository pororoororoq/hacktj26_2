import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Disclaimer } from '../components/Disclaimer';
import { WordCard } from '../components/WordCard';
import { RecordButton } from '../components/RecordButton';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { getChallengeWords, assessSpeech, recordWordResult, ChallengeData, ChallengeWord } from '../services/api';
import { AssessmentResponse } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

const RECORD_DURATION = 3000;

type Phase = 'browse' | 'practice' | 'recording' | 'analyzing' | 'result';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

const CATEGORY_COLORS: Record<string, string> = {
  survival: '#E57373',
  daily: '#5B9BD5',
  emotional: '#FFB74D',
  medical: '#81C784',
};

const TYPE_BADGES: Record<string, { icon: string; label: string; color: string }> = {
  tongue_twister: { icon: '👅', label: 'Tongue Twister', color: '#9C27B0' },
  sentence:       { icon: '💬', label: 'Sentence', color: '#00897B' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}

export function ChallengeScreen() {
  const navigation = useNavigation();
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const [phase, setPhase] = useState<Phase>('browse');
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<ChallengeWord | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await getChallengeWords();
        setData(d);
      } catch {
        setError('Could not load words.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleSelectWord = useCallback((word: ChallengeWord) => {
    setSelectedWord(word);
    setResult(null);
    setError(null);
    setPhase('practice');
  }, []);

  const handleRecord = useCallback(async () => {
    if (isRecording || !selectedWord) return;
    setPhase('recording');
    setCountdown(3);
    await startRecording();

    let remaining = 3;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining > 0 ? remaining : null);
    }, 1000);

    timerRef.current = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      const uri = await stopRecording();
      if (uri) {
        setPhase('analyzing');
        try {
          const response = await assessSpeech([uri], [selectedWord.word]);
          setResult(response);
          // Record to learning engine
          if (response.word_results.length > 0) {
            const wr = response.word_results[0];
            try { await recordWordResult(wr.word, wr.score, wr.phonemes); } catch {}
          }
          setPhase('result');
        } catch {
          setError('Could not reach analysis server.');
          setPhase('result');
        }
      }
    }, RECORD_DURATION);
  }, [isRecording, selectedWord, startRecording, stopRecording]);

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading challenge words...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Practice / Recording / Analyzing / Result ─────────────────────────
  if (phase !== 'browse' && selectedWord) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => { setPhase('browse'); setSelectedWord(null); }}>
            <Text style={styles.backLink}>← Back to words</Text>
          </TouchableOpacity>

          <Text style={styles.header}>Challenge Word</Text>

          {!selectedWord.unlocked && (
            <View style={styles.challengeBadge}>
              <Text style={styles.challengeBadgeText}>🔥 Above your level!</Text>
            </View>
          )}

          <View style={styles.wordCardLarge}>
            {selectedWord.type && TYPE_BADGES[selectedWord.type] && (
              <View style={[styles.typeBadge, { backgroundColor: TYPE_BADGES[selectedWord.type].color + '20', borderColor: TYPE_BADGES[selectedWord.type].color }]}>
                <Text style={{ color: TYPE_BADGES[selectedWord.type].color, fontSize: 12, fontWeight: '600' }}>
                  {TYPE_BADGES[selectedWord.type].icon} {TYPE_BADGES[selectedWord.type].label}
                </Text>
              </View>
            )}
            <Text style={[styles.wordTextLarge, selectedWord.type !== 'word' && { fontSize: 24 }]}>{selectedWord.word}</Text>
            <Text style={styles.wordMeta}>
              {'★'.repeat(selectedWord.difficulty)}{'☆'.repeat(5 - selectedWord.difficulty)}
              {' · '}{selectedWord.category}
            </Text>
            <Text style={styles.phonemeList}>
              /{selectedWord.phonemes.join(' · ')}/
            </Text>
          </View>

          {phase === 'practice' && (
            <View style={styles.phaseSection}>
              <Text style={styles.instruction}>
                Say "{selectedWord.word}" clearly when you press record.
              </Text>
              <RecordButton isRecording={false} onPress={handleRecord} disabled={false} />
            </View>
          )}

          {phase === 'recording' && (
            <View style={styles.phaseSection}>
              {countdown !== null && <Text style={styles.countdown}>{countdown}</Text>}
              <RecordButton isRecording={true} onPress={() => {}} disabled />
            </View>
          )}

          {phase === 'analyzing' && (
            <View style={styles.phaseSection}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.analyzingText}>Analyzing...</Text>
            </View>
          )}

          {phase === 'result' && (
            <View style={styles.phaseSection}>
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : result && result.word_results.length > 0 ? (
                <>
                  <View style={styles.scoreCard}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(result.word_results[0].score) }]}>{result.word_results[0].score}%</Text>
                    <Text style={styles.scoreLabel}>Accuracy</Text>
                  </View>
                  <View style={styles.phonemeResults}>
                    {result.word_results[0].phonemes.map((ph, i) => (
                      <View key={i} style={[styles.phonemeChip, { backgroundColor: ph.status === 'ok' ? '#E8F5E9' : '#FFEBEE' }]}>
                        <Text style={[styles.phonemeChipText, { color: ph.status === 'ok' ? colors.success : colors.error }]}>
                          /{ph.phoneme}/ {ph.accuracy}%
                        </Text>
                      </View>
                    ))}
                  </View>
                  {result.recommendations.map((rec, i) => (
                    <View key={i} style={styles.recCard}>
                      <Text style={styles.recText}>{rec}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              <TouchableOpacity style={styles.primaryButton} onPress={() => setPhase('practice')}>
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setPhase('browse'); setSelectedWord(null); }}>
                <Text style={styles.secondaryButtonText}>Pick Another Word</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // ── Browse mode ───────────────────────────────────────────────────────
  const levels = data ? Object.entries(data.levels).sort(([a], [b]) => Number(a) - Number(b)) : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Challenge Mode</Text>
        <Text style={styles.subheader}>Try any word — even above your level</Text>

        {levels.map(([level, words]) => {
          const lvl = Number(level);
          const isCurrentLevel = data && lvl <= data.current_difficulty;

          return (
            <View key={level} style={styles.levelSection}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelTitle}>
                  Level {level} — {LEVEL_LABELS[lvl] || 'Unknown'}
                </Text>
                {!isCurrentLevel && <Text style={styles.lockedBadge}>🔒 Locked</Text>}
              </View>

              <View style={styles.wordGrid}>
                {words.map((w) => (
                  <TouchableOpacity
                    key={w.word}
                    style={[
                      styles.wordChip,
                      w.mastered && styles.wordChipMastered,
                      !w.unlocked && styles.wordChipLocked,
                      (w.type === 'sentence' || w.type === 'tongue_twister') && { minWidth: 140 },
                    ]}
                    onPress={() => handleSelectWord(w)}
                    activeOpacity={0.7}
                  >
                    {w.type && TYPE_BADGES[w.type] && (
                      <Text style={{ fontSize: 9, color: TYPE_BADGES[w.type].color, fontWeight: '700', marginBottom: 1 }}>
                        {TYPE_BADGES[w.type].icon} {TYPE_BADGES[w.type].label.toUpperCase()}
                      </Text>
                    )}
                    <Text style={[
                      styles.wordChipText,
                      !w.unlocked && styles.wordChipTextLocked,
                      (w.type === 'sentence' || w.type === 'tongue_twister') && { fontSize: 13 },
                    ]}>
                      {w.word}
                    </Text>
                    <View style={styles.wordChipMeta}>
                      {w.mastered && <Text style={styles.masteredBadge}>✓</Text>}
                      {w.best_score > 0 && (
                        <Text style={[styles.wordChipScore, { color: getScoreColor(w.best_score) }]}>
                          {w.best_score}%
                        </Text>
                      )}
                      {!w.unlocked && <Text style={styles.lockIcon}>🔥</Text>}
                    </View>
                    <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[w.category] || colors.textSecondary }]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  header: { ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xs },
  subheader: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  backLink: { ...typography.body, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm },

  // Level sections
  levelSection: { marginBottom: spacing.lg },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  levelTitle: { ...typography.h3, color: colors.text },
  lockedBadge: { ...typography.caption, color: colors.textSecondary },

  // Word grid
  wordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wordChip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    position: 'relative',
  },
  wordChipMastered: { borderWidth: 2, borderColor: colors.success },
  wordChipLocked: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  wordChipText: { ...typography.body, color: colors.text, fontWeight: '600' },
  wordChipTextLocked: { color: colors.textSecondary },
  wordChipMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  wordChipScore: { ...typography.caption, fontWeight: '600' },
  masteredBadge: { fontSize: 12, color: colors.success },
  lockIcon: { fontSize: 10 },
  categoryDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 6, right: 6 },

  // Practice phase
  phaseSection: { alignItems: 'center', marginTop: spacing.lg },
  instruction: { ...typography.bodyLarge, color: colors.text, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 28 },
  countdown: { fontSize: 64, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  analyzingText: { ...typography.h3, color: colors.text, marginTop: spacing.md },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center', marginBottom: spacing.md },

  // Challenge badge
  challengeBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  challengeBadgeText: { ...typography.caption, color: '#E65100', fontWeight: '600' },

  // Word card large
  wordCardLarge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  typeBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginBottom: spacing.sm,
  },
  wordTextLarge: { fontSize: 36, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  wordMeta: { ...typography.body, color: colors.textSecondary },
  phonemeList: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },

  // Score card
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    width: '100%',
  },
  scoreValue: { fontSize: 56, fontWeight: '700', color: colors.primary, lineHeight: 64 },
  scoreLabel: { ...typography.body, color: colors.textSecondary },

  // Phoneme results
  phonemeResults: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md, justifyContent: 'center' },
  phonemeChip: { borderRadius: borderRadius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  phonemeChipText: { ...typography.body, fontWeight: '600' },

  // Recommendations
  recCard: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm, width: '100%' },
  recText: { ...typography.body, color: colors.text },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: { ...typography.button, color: colors.surface },
  secondaryButton: { marginTop: spacing.md, paddingVertical: spacing.sm },
  secondaryButtonText: { ...typography.button, color: colors.textSecondary },
  backButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  backButtonText: { ...typography.button, color: colors.textSecondary },
});
