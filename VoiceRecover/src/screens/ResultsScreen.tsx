import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Disclaimer } from '../components/Disclaimer';
import { PhonemeChart } from '../components/PhonemeChart';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { PitchVisualizer } from '../components/PitchVisualizer';
import { WordResult } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type Nav = StackNavigationProp<RootStackParamList, 'Results'>;
type Route = RouteProp<RootStackParamList, 'Results'>;

function getEncouragement(score: number): string {
  if (score >= 80) return 'Amazing progress!';
  if (score >= 60) return 'Great effort!';
  return 'Keep practicing!';
}

function getEncouragementSub(score: number): string {
  if (score >= 80) return 'You are doing an excellent job. Keep it up!';
  if (score >= 60) return 'You are making real progress. Every session counts.';
  return 'Every attempt builds strength. You are on the right path.';
}

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {
    assessmentScore,
    pitchScore,
    wordResults,
    weakPhonemes,
    recommendations,
    pitchFeedback,
    patientContour,
    targetContour,
  } = route.params;

  const overallScore = (assessmentScore + pitchScore) / 2;
  const encouragement = getEncouragement(overallScore);
  const encouragementSub = getEncouragementSub(overallScore);

  // Cast wordResults to typed array (nav passes any[])
  const typedWordResults = wordResults as WordResult[];
  const hasWordResults = typedWordResults.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.header}>Session Results</Text>

        {/* Encouragement */}
        <View style={styles.encouragementCard}>
          <Text style={styles.encouragementTitle}>{encouragement}</Text>
          <Text style={styles.encouragementSub}>{encouragementSub}</Text>
        </View>

        {/* Overall Score */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Overall Score</Text>
          <View style={styles.scoreRow}>
            <ScoreDisplay score={overallScore} label="Overall" size={130} />
            <View style={styles.subScores}>
              <View style={styles.subScoreItem}>
                <Text style={styles.subScoreValue}>{Math.round(assessmentScore)}%</Text>
                <Text style={styles.subScoreLabel}>Pronunciation</Text>
              </View>
              <View style={styles.subScoreDivider} />
              <View style={styles.subScoreItem}>
                <Text style={styles.subScoreValue}>{Math.round(pitchScore)}%</Text>
                <Text style={styles.subScoreLabel}>Pitch Alignment</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pitch Performance */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pitch Performance</Text>
          <View style={styles.pitchScoreBadge}>
            <Text style={styles.pitchScoreNumber}>{Math.round(pitchScore)}%</Text>
            <Text style={styles.pitchScoreLabel}>Pitch Alignment Score</Text>
          </View>
          {pitchFeedback ? (
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackText}>{pitchFeedback}</Text>
            </View>
          ) : null}
          {/* PitchVisualizer placeholder — shown when contour data is passed */}
          <PitchVisualizer
            targetContour={targetContour ?? []}
            patientContour={patientContour ?? []}
          />
          {(!patientContour || patientContour.length === 0) && (
            <Text style={styles.vizHint}>
              Detailed pitch contour available after MIT therapy session
            </Text>
          )}
        </View>

        {/* Phoneme Analysis */}
        {hasWordResults && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phoneme Analysis</Text>
            <PhonemeChart
              wordResults={typedWordResults}
              weakPhonemes={weakPhonemes}
            />
          </View>
        )}

        {/* Weak Phonemes (when no word results) */}
        {!hasWordResults && weakPhonemes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sounds to Practice</Text>
            <View style={styles.phonemeRow}>
              {weakPhonemes.map((ph, i) => (
                <View key={i} style={styles.phonemeBadge}>
                  <Text style={styles.phonemeText}>/{ph}/</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {recommendations.map((rec, i) => (
              <View key={i} style={styles.recommendationItem}>
                <View style={styles.recommendationBullet} />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Welcome')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Start New Session</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Assessment')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Disclaimer />
    </SafeAreaView>
  );
}

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
    marginBottom: spacing.md,
  },
  encouragementCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  encouragementTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.surface,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  encouragementSub: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  subScores: {
    alignItems: 'center',
    gap: spacing.md,
  },
  subScoreItem: {
    alignItems: 'center',
  },
  subScoreValue: {
    ...typography.h2,
    color: colors.text,
  },
  subScoreLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subScoreDivider: {
    width: 40,
    height: 1,
    backgroundColor: colors.border,
  },
  pitchScoreBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pitchScoreNumber: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.secondary,
    lineHeight: 48,
  },
  pitchScoreLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feedbackBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  feedbackText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  vizHint: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  phonemeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phonemeBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.phonemeWeak,
  },
  phonemeText: {
    ...typography.body,
    color: colors.phonemeWeak,
    fontFamily: 'monospace',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  recommendationBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 8,
    flexShrink: 0,
  },
  recommendationText: {
    ...typography.bodyLarge,
    color: colors.text,
    flex: 1,
    lineHeight: 28,
  },
  buttonSection: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    width: '100%',
    alignItems: 'center',
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
