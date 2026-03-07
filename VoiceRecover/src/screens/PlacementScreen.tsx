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
import { WordCard } from '../components/WordCard';
import { RecordButton } from '../components/RecordButton';
import { Disclaimer } from '../components/Disclaimer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { assessSpeech, getPlacementWords, submitPlacementResult, PlacementWord } from '../services/api';
import { updatePlacementDone } from '../services/auth';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

const RECORD_DURATION = 3000;

interface Props {
  onComplete: () => void;
}

export function PlacementScreen({ onComplete }: Props) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const [phase, setPhase] = useState<'intro' | 'recording' | 'analyzing' | 'result'>('intro');
  const [words, setWords] = useState<PlacementWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startingLevel, setStartingLevel] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingWords, setLoadingWords] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch placement words on mount
  useEffect(() => {
    (async () => {
      try {
        const pw = await getPlacementWords();
        setWords(pw);
      } catch {
        setError('Could not load placement test. Please check your connection.');
      } finally {
        setLoadingWords(false);
      }
    })();
  }, []);

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

            // Build scores and phoneme data for placement
            const scores: Record<string, number> = {};
            const phonemeData: Record<string, { phoneme: string; accuracy: number }[]> = {};
            for (const wr of response.word_results) {
              scores[wr.word] = wr.score;
              if (wr.phonemes) {
                phonemeData[wr.word] = wr.phonemes.map(p => ({
                  phoneme: p.phoneme,
                  accuracy: p.accuracy,
                }));
              }
            }

            // Submit placement result
            const result = await submitPlacementResult(scores, phonemeData);
            setStartingLevel(result.starting_difficulty);

            // Update local storage
            await updatePlacementDone();

            setPhase('result');
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

  // ── Intro phase ──
  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroSection}>
            <Text style={styles.emoji}>🎯</Text>
            <Text style={styles.title}>Placement Test</Text>
            <Text style={styles.subtitle}>
              Let's find the right starting level for you
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How it works</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>You'll say 6 words out loud</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>We'll analyze your pronunciation</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>You'll start at the right difficulty level</Text>
            </View>
          </View>

          {loadingWords ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => setPhase('recording')}
            >
              <Text style={styles.startButtonText}>Begin Test</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // ── Recording phase ──
  if (phase === 'recording') {
    const currentWord = words[currentIndex];
    const progress = ((currentIndex) / words.length) * 100;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
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
          <Text style={styles.analyzingTitle}>Analyzing your speech...</Text>
          <Text style={styles.analyzingSub}>Finding your starting level</Text>
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // ── Result phase ──
  const levelMessages: Record<number, { emoji: string; title: string; desc: string }> = {
    1: {
      emoji: '🌱',
      title: 'Starting at Level 1',
      desc: "We'll begin with simple, everyday words and build up from there.",
    },
    2: {
      emoji: '🌿',
      title: 'Starting at Level 2',
      desc: "You've got a solid foundation! We'll start with two-syllable words.",
    },
    3: {
      emoji: '🌳',
      title: 'Starting at Level 3',
      desc: "Impressive! You're ready for multi-syllable words and short phrases.",
    },
  };
  const msg = levelMessages[startingLevel] || levelMessages[1];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.resultEmoji}>{msg.emoji}</Text>
        <Text style={styles.resultTitle}>{msg.title}</Text>
        <Text style={styles.resultDesc}>{msg.desc}</Text>

        <View style={styles.levelIndicator}>
          {[1, 2, 3, 4, 5].map(level => (
            <View
              key={level}
              style={[
                styles.levelDot,
                level <= startingLevel && styles.levelDotActive,
              ]}
            >
              <Text style={[
                styles.levelDotText,
                level <= startingLevel && styles.levelDotTextActive,
              ]}>
                {level}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.getStartedButton} onPress={onComplete}>
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.screenPadding },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },

  // Intro
  heroSection: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.lg },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  stepText: { ...typography.body, color: colors.text, flex: 1 },

  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: { ...typography.button, color: '#fff', fontSize: 18 },

  // Recording
  header: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.lg },
  countdown: { fontSize: 64, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  errorText: { ...typography.body, color: colors.error, marginTop: spacing.md, textAlign: 'center' },

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
    position: 'absolute',
    top: spacing.lg,
    left: spacing.screenPadding,
    right: spacing.screenPadding,
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

  // Analyzing
  analyzingTitle: { ...typography.h3, color: colors.text, marginTop: spacing.lg },
  analyzingSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },

  // Result
  resultEmoji: { fontSize: 72, marginBottom: spacing.lg },
  resultTitle: { ...typography.h1, color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },
  resultDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.lg },

  levelIndicator: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  levelDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  levelDotText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  levelDotTextActive: { color: '#fff' },

  getStartedButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedText: { ...typography.button, color: '#fff', fontSize: 18 },
});
