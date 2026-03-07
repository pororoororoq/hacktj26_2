import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { WordCard } from '../components/WordCard';
import { RecordButton } from '../components/RecordButton';
import { PhonemeChart } from '../components/PhonemeChart';
import { Disclaimer } from '../components/Disclaimer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { assessSpeech, getNextWords, recordWordResult, recordSession, NextWord } from '../services/api';
import { AssessmentResponse } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

const FALLBACK_WORDS = ['water', 'happy', 'morning'];
const RECORD_DURATION = 3000; // 3 seconds

function getScoreColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}

type Nav = StackNavigationProp<RootStackParamList, 'Assessment'>;

export function AssessmentScreen() {
  const navigation = useNavigation<Nav>();
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const [words, setWords] = useState<string[]>(FALLBACK_WORDS);
  const [wordMeta, setWordMeta] = useState<NextWord[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Fetch adaptive words on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nextWords = await getNextWords(3);
        if (!cancelled && nextWords.length > 0) {
          setWords(nextWords.map(w => w.word));
          setWordMeta(nextWords);
        }
      } catch (err) {
        console.log('Could not fetch adaptive words, using fallback');
      } finally {
        if (!cancelled) setIsLoadingWords(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup timers on unmount
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

    // Countdown timer
    let remaining = 3;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining > 0 ? remaining : null);
    }, 1000);

    // Auto-stop after RECORD_DURATION
    timerRef.current = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      const uri = await stopRecording();
      if (uri) {
        const newRecordings = [...recordings, uri];
        setRecordings(newRecordings);

        if (newRecordings.length >= words.length) {
          // All words recorded, analyze
          setIsAnalyzing(true);
          try {
            const response = await assessSpeech(newRecordings, words);
            setResults(response);

            // Record each word result to the adaptive learning engine
            for (const wr of response.word_results) {
              try {
                await recordWordResult(wr.word, wr.score, wr.phonemes);
              } catch (e) {
                console.log('Could not record word result:', e);
              }
            }

            // Record the session
            const sessionScores: Record<string, number> = {};
            for (const wr of response.word_results) {
              sessionScores[wr.word] = wr.score;
            }
            const durationS = (Date.now() - sessionStartRef.current) / 1000;
            try {
              await recordSession('assessment', sessionScores, durationS);
            } catch (e) {
              console.log('Could not record session:', e);
            }
          } catch (err) {
            setError('Could not connect to analysis server. Please check your connection.');
          } finally {
            setIsAnalyzing(false);
          }
        } else {
          setCurrentWordIndex(currentWordIndex + 1);
        }
      }
    }, RECORD_DURATION);
  }, [isRecording, recordings, currentWordIndex, words, startRecording, stopRecording]);

  // Loading words phase
  if (isLoadingWords) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzingText}>Preparing your practice words...</Text>
          <Text style={styles.analyzingSubtext}>Selecting words tailored to your progress</Text>
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // Recording phase
  if (!results && !isAnalyzing) {
    const currentMeta = wordMeta.find(m => m.word === words[currentWordIndex]);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.header}>Speech Assessment</Text>

          {/* Word difficulty badge */}
          {currentMeta && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaText}>
                {currentMeta.type === 'tongue_twister' ? '👅 Tongue Twister' : currentMeta.type === 'sentence' ? '💬 Sentence' : (currentMeta.times_practiced === 0 ? 'New Word' : `Practiced ${currentMeta.times_practiced}x`)}
                {' · '}
                {'★'.repeat(currentMeta.difficulty)}{'☆'.repeat(5 - currentMeta.difficulty)}
              </Text>
            </View>
          )}

          <WordCard word={words[currentWordIndex]} currentIndex={currentWordIndex} totalWords={words.length} />
          {countdown !== null && <Text style={styles.countdown}>{countdown}</Text>}
          <RecordButton isRecording={isRecording} onPress={handleRecord} disabled={isRecording} />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // Analyzing phase
  if (isAnalyzing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzingText}>Analyzing your speech...</Text>
          <Text style={styles.analyzingSubtext}>This may take a few seconds</Text>
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  // Results phase
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Assessment Results</Text>
        <View style={styles.overallScore}>
          <Text style={[styles.scoreValue, { color: getScoreColor(results!.overall_score) }]}>{results!.overall_score}%</Text>
          <Text style={styles.scoreLabel}>Overall Score</Text>
        </View>
        <PhonemeChart wordResults={results!.word_results} weakPhonemes={results!.weak_phonemes} />
        {results!.recommendations.map((rec, i) => (
          <View key={i} style={styles.recCard}>
            <Text style={styles.recText}>{rec}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => navigation.navigate('MIT', {
            weakPhonemes: results!.weak_phonemes,
            assessmentScore: results!.overall_score,
            wordResults: results!.word_results,
            recommendations: results!.recommendations,
          })}
        >
          <Text style={styles.continueText}>Continue to Melody Therapy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.progressButton}
          onPress={() => navigation.navigate('Progress' as any)}
        >
          <Text style={styles.progressButtonText}>View Progress</Text>
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
  header: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.xl, marginTop: spacing.lg },
  countdown: { fontSize: 64, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  analyzingText: { ...typography.h3, color: colors.text, marginTop: spacing.lg },
  analyzingSubtext: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  error: { ...typography.body, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  overallScore: { alignItems: 'center', marginBottom: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  scoreValue: { ...typography.score, color: colors.primary },
  scoreLabel: { ...typography.body, color: colors.textSecondary },
  recCard: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm },
  recText: { ...typography.body, color: colors.text },
  continueButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.xl, alignItems: 'center', marginTop: spacing.xl },
  continueText: { ...typography.button, color: colors.surface },
  metaBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  progressButtonText: {
    ...typography.button,
    color: colors.primary,
  },
});
