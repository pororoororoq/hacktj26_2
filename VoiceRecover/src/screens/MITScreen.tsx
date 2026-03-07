import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RecordButton } from '../components/RecordButton';
import { Disclaimer } from '../components/Disclaimer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { analyzePitch, getTtsUrl, getNextPhrase, recordPhraseResult, recordSession, NextPhrase } from '../services/api';
import { PitchAnalysisResponse } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// Import all phrase data files
import phrase1 from '../assets/melodies/phrase1_pitch.json';
import phrase2 from '../assets/melodies/phrase2_pitch.json';
import phrase3 from '../assets/melodies/phrase3_pitch.json';
import phrase4 from '../assets/melodies/phrase4_pitch.json';
import phrase5 from '../assets/melodies/phrase5_pitch.json';
import phrase6 from '../assets/melodies/phrase6_pitch.json';
import phrase7 from '../assets/melodies/phrase7_pitch.json';
import phrase8 from '../assets/melodies/phrase8_pitch.json';
import phrase9 from '../assets/melodies/phrase9_pitch.json';
import phrase10 from '../assets/melodies/phrase10_pitch.json';
import phrase11 from '../assets/melodies/phrase11_pitch.json';
import phrase12 from '../assets/melodies/phrase12_pitch.json';
import phrase13 from '../assets/melodies/phrase13_pitch.json';
import phrase14 from '../assets/melodies/phrase14_pitch.json';
import phrase15 from '../assets/melodies/phrase15_pitch.json';

const PHRASE_MAP: Record<string, any> = {
  phrase1, phrase2, phrase3, phrase4, phrase5,
  phrase6, phrase7, phrase8, phrase9, phrase10,
  phrase11, phrase12, phrase13, phrase14, phrase15,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'listen' | 'sing' | 'analyzing' | 'results';

type Nav = StackNavigationProp<RootStackParamList, 'MIT'>;
type Route = RouteProp<RootStackParamList, 'MIT'>;

interface DisplayPoint {
  time: number;
  normFreq: number;
}

const RECORD_SECONDS = 5;

// ─── Melody Visualiser ───────────────────────────────────────────────────────

interface MelodyLineProps {
  displayPoints: DisplayPoint[];
  duration: number;
  progress?: number;
  showPlayhead?: boolean;
  patientPoints?: DisplayPoint[];
}

function MelodyLine({ displayPoints, duration, progress = 0, showPlayhead = false, patientPoints }: MelodyLineProps) {
  const DOT_SIZE = 10;
  const BAR_HEIGHT = 80;
  const TOTAL_WIDTH = 300;

  const playheadX = progress * TOTAL_WIDTH;

  return (
    <View style={[melodyStyles.container, { width: TOTAL_WIDTH, height: BAR_HEIGHT + DOT_SIZE }]}>
      {displayPoints.map((pt, i) => {
        const x = (pt.time / duration) * TOTAL_WIDTH;
        const y = BAR_HEIGHT - pt.normFreq * BAR_HEIGHT;
        const isActive = showPlayhead && (pt.time / duration) <= progress;
        return (
          <View
            key={i}
            style={[
              melodyStyles.dot,
              {
                left: x - DOT_SIZE / 2,
                top: y,
                backgroundColor: isActive ? colors.secondary : colors.pitchTarget,
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                opacity: isActive ? 1 : 0.6,
              },
            ]}
          />
        );
      })}

      {patientPoints &&
        patientPoints.map((pt, i) => {
          const x = (pt.time / duration) * TOTAL_WIDTH;
          const y = BAR_HEIGHT - pt.normFreq * BAR_HEIGHT;
          return (
            <View
              key={`pat-${i}`}
              style={[
                melodyStyles.dot,
                {
                  left: x - 5,
                  top: y - 1,
                  backgroundColor: colors.pitchPatient,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  opacity: 0.85,
                },
              ]}
            />
          );
        })}

      {showPlayhead && progress > 0 && (
        <View
          style={[
            melodyStyles.playhead,
            { left: playheadX, height: BAR_HEIGHT + DOT_SIZE },
          ]}
        />
      )}
    </View>
  );
}

const melodyStyles = StyleSheet.create({
  container: { position: 'relative', alignSelf: 'center' },
  dot: { position: 'absolute' },
  playhead: { position: 'absolute', width: 2, backgroundColor: colors.primary, opacity: 0.7, top: 0 },
});

// ─── Word segments label ──────────────────────────────────────────────────────

function WordLabels({ segments, duration }: { segments: { word: string; start: number; end: number }[]; duration: number }) {
  const TOTAL_WIDTH = 300;
  return (
    <View style={{ width: TOTAL_WIDTH, flexDirection: 'row', alignSelf: 'center', marginTop: spacing.xs }}>
      {segments.map((seg, i) => {
        const left = (seg.start / duration) * TOTAL_WIDTH;
        const width = ((seg.end - seg.start) / duration) * TOTAL_WIDTH;
        return (
          <View key={i} style={{ position: 'absolute', left, width, alignItems: 'center' }}>
            <Text style={wordLabelStyles.label}>{seg.word}</Text>
          </View>
        );
      })}
    </View>
  );
}

const wordLabelStyles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textSecondary },
});

// ─── MITScreen ────────────────────────────────────────────────────────────────

export function MITScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { weakPhonemes, assessmentScore, wordResults, recommendations } = route.params;

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const [phase, setPhase] = useState<Phase>('loading');
  const [phraseId, setPhraseId] = useState<string>('phrase1');
  const [phraseData, setPhraseData] = useState<any>(phrase1);
  const [phraseMeta, setPhraseMeta] = useState<NextPhrase | null>(null);
  const [countdown, setCountdown] = useState<number>(RECORD_SECONDS);
  const [pitchResult, setPitchResult] = useState<PitchAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Compute display points from current phrase data
  const rawContour = (phraseData.pitch_contour || []) as { time: number; frequency: number }[];
  const minHz = Math.min(...rawContour.map((p: any) => p.frequency));
  const maxHz = Math.max(...rawContour.map((p: any) => p.frequency));
  const displayPoints: DisplayPoint[] = rawContour.map((p: any) => ({
    time: p.time,
    normFreq: (p.frequency - minHz) / (maxHz - minHz || 1),
  }));
  const phraseDurationMs = (phraseData.duration || 2) * 1000;

  const { play, stop: stopPlayback, isPlaying, progress: playbackProgress } = useAudioPlayback(phraseDurationMs);

  // Fetch next phrase from adaptive engine on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getNextPhrase();
        if (!cancelled && next) {
          const id = next.phrase_id;
          setPhraseId(id);
          setPhraseMeta(next);
          // Use the local phrase data file
          if (PHRASE_MAP[id]) {
            setPhraseData(PHRASE_MAP[id]);
          }
        }
      } catch (err) {
        console.log('Could not fetch adaptive phrase, using default');
      } finally {
        if (!cancelled) setPhase('listen');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Listen phase: play visual melody ────────────────────────────────────────

  const ttsUrl = getTtsUrl(phraseData.text);

  const handlePlayMelody = useCallback(async () => {
    if (isPlaying) {
      await stopPlayback();
      return;
    }
    await play(ttsUrl);
  }, [isPlaying, play, stopPlayback, ttsUrl]);

  // ── Sing phase: record with countdown ───────────────────────────────────────

  const handleStartSinging = useCallback(async () => {
    setPhase('sing');
    setCountdown(RECORD_SECONDS);
    await startRecording();

    let remaining = RECORD_SECONDS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }, 1000);

    timerRef.current = setTimeout(async () => {
      const uri = await stopRecording();
      setPhase('analyzing');
      try {
        const result = await analyzePitch(uri ?? '', phraseData.id);
        setPitchResult(result);

        // Record result to adaptive engine
        try {
          await recordPhraseResult(phraseId, Math.round(result.alignment_score));
          const durationS = (Date.now() - sessionStartRef.current) / 1000;
          await recordSession('melody', { [phraseId]: Math.round(result.alignment_score) }, durationS);
        } catch (e) {
          console.log('Could not record phrase result:', e);
        }

        setPhase('results');
      } catch {
        setError('Could not reach analysis server. Please check your connection.');
        setPhase('results');
      }
    }, RECORD_SECONDS * 1000);
  }, [startRecording, stopRecording, phraseData, phraseId]);

  // ── Navigate to Results screen ───────────────────────────────────────────────

  const handleContinue = useCallback(() => {
    navigation.navigate('Results', {
      assessmentScore,
      pitchScore: pitchResult?.alignment_score ?? 0,
      wordResults,
      weakPhonemes,
      recommendations,
      pitchFeedback: pitchResult?.feedback ?? '',
      patientContour: pitchResult?.patient_pitch_contour ?? [],
      targetContour: pitchResult?.target_pitch_contour ?? [],
    });
  }, [navigation, pitchResult, weakPhonemes, assessmentScore, wordResults, recommendations]);

  // ── Derive patient display points for results overlay ───────────────────────

  const patientDisplayPoints: DisplayPoint[] | undefined = pitchResult
    ? (() => {
        const pts = pitchResult.patient_pitch_contour;
        const minF = Math.min(...pts.map((p) => p.frequency));
        const maxF = Math.max(...pts.map((p) => p.frequency));
        return pts.map((p) => ({
          time: p.time,
          normFreq: (p.frequency - minF) / (maxF - minF || 1),
        }));
      })()
    : undefined;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzingText}>Selecting your phrase...</Text>
        </View>
        <Disclaimer />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text style={styles.header}>Melodic Therapy</Text>
        <Text style={styles.subheader}>
          {phraseMeta
            ? `Level ${phraseMeta.level} · ${phraseMeta.times_practiced === 0 ? 'New Phrase' : `Practiced ${phraseMeta.times_practiced}x`}`
            : 'Phrase Practice'}
        </Text>

        {/* Phrase text */}
        <View style={styles.phraseCard}>
          <Text style={styles.phraseText}>{phraseData.text}</Text>
        </View>

        {/* Melody visualiser */}
        <View style={styles.visualiserContainer}>
          <Text style={styles.visualiserLabel}>
            {phase === 'listen' && 'Target melody pattern'}
            {phase === 'sing' && 'Sing along with this pattern'}
            {phase === 'analyzing' && 'Analysing your pitch...'}
            {phase === 'results' && 'Your pitch vs. target'}
          </Text>
          <MelodyLine
            displayPoints={displayPoints}
            duration={phraseData.duration}
            progress={isPlaying ? playbackProgress : phase === 'listen' ? 0 : 1}
            showPlayhead={isPlaying}
            patientPoints={phase === 'results' ? patientDisplayPoints : undefined}
          />
          <WordLabels
            segments={(phraseData.word_segments || []) as { word: string; start: number; end: number }[]}
            duration={phraseData.duration}
          />

          {/* Legend (results phase) */}
          {phase === 'results' && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                <Text style={styles.legendText}>Target</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.pitchPatient }]} />
                <Text style={styles.legendText}>Your pitch</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Phase: listen ── */}
        {phase === 'listen' && (
          <View style={styles.phaseSection}>
            <Text style={styles.instruction}>
              Listen to the melody pattern, then try singing it yourself.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={handlePlayMelody} activeOpacity={0.8}>
              <Text style={styles.playButtonIcon}>{isPlaying ? '⏹' : '▶'}</Text>
              <Text style={styles.playButtonText}>
                {isPlaying ? 'Stop' : 'Listen to Phrase'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartSinging} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Now You Try</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase: sing ── */}
        {phase === 'sing' && (
          <View style={styles.phaseSection}>
            <Text style={styles.instruction}>
              Sing the phrase following the melody shape above.
            </Text>
            <View style={styles.countdownWrapper}>
              <Text style={styles.countdown}>{countdown}</Text>
              <Text style={styles.countdownLabel}>seconds remaining</Text>
            </View>
            <RecordButton isRecording={isRecording} onPress={() => {}} disabled />
          </View>
        )}

        {/* ── Phase: analyzing ── */}
        {phase === 'analyzing' && (
          <View style={styles.phaseSection}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.md }} />
            <Text style={styles.analyzingText}>Analysing your singing...</Text>
            <Text style={styles.analyzingSubtext}>This only takes a moment</Text>
          </View>
        )}

        {/* ── Phase: results ── */}
        {phase === 'results' && (
          <View style={styles.phaseSection}>
            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreValue}>
                    {pitchResult ? `${Math.round(pitchResult.alignment_score)}%` : '--'}
                  </Text>
                  <Text style={styles.scoreLabel}>Pitch Alignment</Text>
                </View>
                {pitchResult && (
                  <View style={styles.feedbackCard}>
                    <Text style={styles.feedbackText}>{pitchResult.feedback}</Text>
                  </View>
                )}
              </>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Continue to Results</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setPitchResult(null);
                setError(null);
                setPhase('listen');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },
  header: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  subheader: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  phraseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  phraseText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  visualiserContainer: {
    backgroundColor: colors.pitchBackground,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  visualiserLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  legend: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  phaseSection: {
    alignItems: 'center',
  },
  instruction: {
    ...typography.bodyLarge,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 28,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  playButtonIcon: {
    fontSize: 20,
    color: colors.surface,
  },
  playButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  countdownWrapper: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  countdown: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 80,
  },
  countdownLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  analyzingText: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  analyzingSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
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
  scoreValue: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 64,
  },
  scoreLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  feedbackCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    width: '100%',
  },
  feedbackText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
});
