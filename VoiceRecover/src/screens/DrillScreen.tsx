import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { WordCard } from '../components/WordCard';
import { RecordButton } from '../components/RecordButton';
import { PhonemeChart } from '../components/PhonemeChart';
import { Disclaimer } from '../components/Disclaimer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { assessSpeech, getDrillWords, recordWordResult, recordSession, NextWord } from '../services/api';
import { AssessmentResponse } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

const RECORD_DURATION = 3000;

type DrillRouteParams = {
  Drill: { phoneme: string };
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}

export function DrillScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<DrillRouteParams, 'Drill'>>();
  const phoneme = route.params.phoneme;

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const [phase, setPhase] = useState<'loading' | 'recording' | 'analyzing' | 'summary'>('loading');
  const [words, setWords] = useState<NextWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [results, setResults] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Fetch drill words on mount
  useEffect(() => {
    (async () => {
      try {
        const drillWords = await getDrillWords(phoneme, 5);
        if (drillWords.length === 0) {
          setError(`No unlocked words found containing the /${phoneme}/ sound. Practice more words first!`);
          return;
        }
        setWords(drillWords);
        setPhase('recording');
      } catch {
        setError('Could not load drill words. Please check your connection.');
      }
    })();
  }, [phoneme]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleRecord = useCallback(async () => {
    if (isRecording) return;

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
        const newRecordings = [...recordings, uri];
        setRecordings(newRecordings);

        if (newRecordings.length >= words.length) {
          // All words recorded — analyze
          setPhase('analyzing');
          try {
            const wordNames = words.map(w => w.word);
            const response = await assessSpeech(newRecordings, wordNames);
            setResults(response);

            // Record each word result
            for (const wr of response.word_results) {
              try {
                await recordWordResult(wr.word, wr.score, wr.phonemes);
              } catch (e) {
                console.log('Could not record drill word result:', e);
              }
            }

            // Record session
            const sessionScores: Record<string, number> = {};
            for (const wr of response.word_results) {
              sessionScores[wr.word] = wr.score;
            }
            const durationS = (Date.now() - sessionStartRef.current) / 1000;
            try {
              await recordSession('assessment', sessionScores, durationS);
            } catch (e) {
              console.log('Could not record drill session:', e);
            }

            setPhase('summary');
          } catch {
            setError('Analysis failed. Please try again.');
            setPhase('recording');
            setRecordings([]);
            setCurrentIndex(0);
          }
        } else {
          setCurrentIndex(currentIndex + 1);
        }
      }
    }, RECORD_DURATION);
  }, [isRecording, recordings, currentIndex, words, startRecording, stopRecording]);

  // Compute phoneme-specific stats from results
  const getPhonemeStats = () => {
    if (!results) return { avg: 0, scores: [] as { word: string; accuracy: number }[] };

    const scores: { word: string; accuracy: number }[] = [];
    let totalAcc = 0;
    let count = 0;

    for (const wr of results.word_results) {
      if (wr.phonemes) {
        const match = wr.phonemes.find(
          p => p.phoneme.toLowerCase() === phoneme.toLowerCase(),
        );
        if (match) {
          scores.push({ word: wr.word, accuracy: match.accuracy });
          totalAcc += match.accuracy;
          count += 1;
        }
      }
    }

    return {
      avg: count > 0 ? Math.round(totalAcc / count) : 0,
      scores,
    };
  };

  // ── Loading phase ──
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {error ? (
            <>
              <Text style={styles.errorEmoji}>😕</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingTitle}>Preparing Drill</Text>
              <Text style={styles.loadingSub}>Finding words with /{phoneme}/ sound...</Text>
            </>
          )}
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // ── Recording phase ──
  if (phase === 'recording') {
    const currentWord = words[currentIndex];
    const progress = (currentIndex / words.length) * 100;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Header with phoneme badge */}
          <View style={styles.drillBadge}>
            <Text style={styles.drillBadgeText}>/{phoneme}/ Sound Drill</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{currentIndex + 1} / {words.length}</Text>
          </View>

          <Text style={styles.header}>Say this word</Text>

          {/* Difficulty badge */}
          <View style={styles.diffBadge}>
            <Text style={styles.diffBadgeText}>
              Level {currentWord.difficulty}
              {' · '}
              {'★'.repeat(currentWord.difficulty)}{'☆'.repeat(5 - currentWord.difficulty)}
            </Text>
          </View>

          <WordCard
            word={currentWord.word}
            currentIndex={currentIndex}
            totalWords={words.length}
          />

          {countdown !== null && (
            <Text style={styles.countdown}>{countdown}</Text>
          )}

          <RecordButton
            isRecording={isRecording}
            onPress={handleRecord}
            disabled={isRecording}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // ── Analyzing phase ──
  if (phase === 'analyzing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>Analyzing your speech...</Text>
          <Text style={styles.loadingSub}>Checking /{phoneme}/ pronunciation</Text>
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // ── Summary phase ──
  const phonemeStats = getPhonemeStats();
  const overallScore = results?.overall_score ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Drill header */}
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryBadge}>/{phoneme}/ Sound Drill</Text>
          <Text style={styles.summaryTitle}>Drill Complete!</Text>
        </View>

        {/* Overall score */}
        <View style={styles.overallScore}>
          <Text style={[styles.scoreValue, { color: getScoreColor(overallScore) }]}>
            {overallScore}%
          </Text>
          <Text style={styles.scoreLabel}>Overall Score</Text>
        </View>

        {/* Phoneme-specific results */}
        {phonemeStats.scores.length > 0 && (
          <View style={styles.phonemeSection}>
            <Text style={styles.sectionTitle}>/{phoneme}/ Accuracy Per Word</Text>
            {phonemeStats.scores.map((s, i) => (
              <View key={i} style={styles.phonemeRow}>
                <Text style={styles.phonemeWord}>{s.word}</Text>
                <View style={styles.phonemeBarBg}>
                  <View
                    style={[
                      styles.phonemeBarFill,
                      {
                        width: `${Math.min(s.accuracy, 100)}%`,
                        backgroundColor: getScoreColor(s.accuracy),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.phonemeAcc, { color: getScoreColor(s.accuracy) }]}>
                  {s.accuracy}%
                </Text>
              </View>
            ))}
            <View style={styles.phonemeAvgRow}>
              <Text style={styles.phonemeAvgLabel}>/{phoneme}/ Average</Text>
              <Text style={[styles.phonemeAvgValue, { color: getScoreColor(phonemeStats.avg) }]}>
                {phonemeStats.avg}%
              </Text>
            </View>
          </View>
        )}

        {/* Full phoneme chart */}
        {results && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>All Sounds</Text>
            <PhonemeChart
              wordResults={results.word_results}
              weakPhonemes={results.weak_phonemes}
            />
          </View>
        )}

        {/* Recommendations */}
        {results?.recommendations?.map((rec, i) => (
          <View key={i} style={styles.recCard}>
            <Text style={styles.recText}>{rec}</Text>
          </View>
        ))}

        {/* Done button */}
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.screenPadding },
  scrollContent: { padding: spacing.screenPadding, paddingBottom: spacing.xxl },

  // Loading
  loadingTitle: { ...typography.h3, color: colors.text, marginTop: spacing.lg },
  loadingSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },

  // Error
  errorEmoji: { fontSize: 56, marginBottom: spacing.md },
  errorText: { ...typography.body, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  backButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.xl,
    marginTop: spacing.xl,
  },
  backButtonText: { ...typography.button, color: '#fff', fontSize: 16 },

  // Recording
  drillBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  drillBadgeText: { ...typography.button, color: '#fff', fontSize: 14 },
  header: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
  countdown: { fontSize: 64, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  diffBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  diffBadgeText: { ...typography.caption, color: colors.textSecondary },

  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  // Summary
  summaryHeader: { alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.md },
  summaryBadge: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  summaryTitle: { ...typography.h1, color: colors.text },

  overallScore: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  scoreValue: { ...typography.score, color: colors.primary },
  scoreLabel: { ...typography.body, color: colors.textSecondary },

  // Phoneme-specific results
  phonemeSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  phonemeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  phonemeWord: { ...typography.body, color: colors.text, width: 80, fontWeight: '600' },
  phonemeBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 5,
    overflow: 'hidden',
  },
  phonemeBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  phonemeAcc: { width: 42, textAlign: 'right', fontWeight: '700', fontSize: 14 },
  phonemeAvgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  phonemeAvgLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  phonemeAvgValue: { fontSize: 22, fontWeight: '700' },

  // Chart section
  chartSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  // Recommendations
  recCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recText: { ...typography.body, color: colors.text },

  // Done button
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: { ...typography.button, color: '#fff', fontSize: 18 },
});
