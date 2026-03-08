import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, SafeAreaView, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Disclaimer } from '../components/Disclaimer';
import { PhonemeChart } from '../components/PhonemeChart';
import { PitchVisualizer } from '../components/PitchVisualizer';
import { FadeInView } from '../components/FadeInView';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AnimatedProgressBar } from '../components/AnimatedProgressBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { WordResult } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type Nav   = StackNavigationProp<RootStackParamList, 'Results'>;
type Route = RouteProp<RootStackParamList, 'Results'>;

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.accent;
  if (score >= 40) return colors.warning;
  return colors.error;
}

function getEncouragement(score: number) {
  if (score >= 80) return { title: 'Amazing progress!', sub: 'You are doing an excellent job. Keep it up!',              emoji: '\uD83C\uDF89' };
  if (score >= 60) return { title: 'Great effort!',     sub: 'You are making real progress. Every session counts.',       emoji: '\uD83D\uDCAA' };
  return                  { title: 'Keep practicing!',  sub: 'Every attempt builds strength. You are on the right path.', emoji: '\uD83C\uDF31' };
}

function ScoreRing({ score, size = 120, delay = 0 }: { score: number; size?: number; delay?: number }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const color = getScoreColor(score);
  useEffect(() => {
    Animated.timing(anim, { toValue: score, duration: 1000, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [score]);
  const displayScore = anim.interpolate({ inputRange: [0, score === 0 ? 1 : score], outputRange: ['0', String(Math.round(score))] });
  return (
    <View style={[ringStyles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color + '30' }]}>
      <View style={[ringStyles.inner, { backgroundColor: color + '12' }]}>
        <Animated.Text style={[ringStyles.score, { color, fontSize: size * 0.28 }]}>{displayScore}</Animated.Text>
        <Text style={[ringStyles.pct, { color }]}>%</Text>
      </View>
    </View>
  );
}
const ringStyles = StyleSheet.create({
  ring:  { borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  inner: { position: 'absolute', inset: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  score: { fontWeight: '800', letterSpacing: -1 },
  pct:   { fontSize: 13, fontWeight: '700', marginTop: -6 },
});

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { assessmentScore, pitchScore, wordResults, weakPhonemes, recommendations, pitchFeedback, patientContour, targetContour } = route.params;
  const overallScore  = (assessmentScore + pitchScore) / 2;
  const encouragement = getEncouragement(overallScore);
  const typedResults  = wordResults as WordResult[];
  const goHome = () => {
    const parent = navigation.getParent();
    if (parent) parent.navigate('HomeTab');
    navigation.reset({ index: 0, routes: [{ name: 'Assessment' }] });
  };
  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <FadeInView fromY={-16} duration={400}><ScreenHeader title="Session Results" centered /></FadeInView>

        {/* Encouragement */}
        <FadeInView delay={120} fromY={24} duration={480}>
          <View style={[s.banner, { backgroundColor: getScoreColor(overallScore) + '14', borderColor: getScoreColor(overallScore) + '28' }]}>
            <Text style={s.bannerEmoji}>{encouragement.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: getScoreColor(overallScore) }]}>{encouragement.title}</Text>
              <Text style={s.bannerSub}>{encouragement.sub}</Text>
            </View>
          </View>
        </FadeInView>

        {/* Score */}
        <FadeInView delay={220} fromY={20} duration={480} style={s.card}>
          <Text style={s.cardTitle}>Overall Score</Text>
          <View style={s.scoreRow}>
            <ScoreRing score={overallScore} size={128} delay={300} />
            <View style={s.subScores}>
              <View style={s.subItem}>
                <View style={s.subItemHeader}>
                  <Text style={s.subLabel}>Pronunciation</Text>
                  <Text style={[s.subValue, { color: getScoreColor(assessmentScore) }]}>{Math.round(assessmentScore)}%</Text>
                </View>
                <AnimatedProgressBar progress={assessmentScore} delay={480} height={7} color={getScoreColor(assessmentScore)} />
              </View>
              <View style={s.subItem}>
                <View style={s.subItemHeader}>
                  <Text style={s.subLabel}>Pitch</Text>
                  <Text style={[s.subValue, { color: getScoreColor(pitchScore) }]}>{Math.round(pitchScore)}%</Text>
                </View>
                <AnimatedProgressBar progress={pitchScore} delay={580} height={7} color={getScoreColor(pitchScore)} />
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Pitch */}
        <FadeInView delay={340} fromY={20} duration={460} style={s.card}>
          <Text style={s.cardTitle}>Pitch Performance</Text>
          {pitchFeedback ? (
            <View style={s.feedbackBox}>
              <View style={[s.feedbackAccent, { backgroundColor: colors.secondary }]} />
              <Text style={s.feedbackText}>{pitchFeedback}</Text>
            </View>
          ) : null}
          <PitchVisualizer targetContour={targetContour ?? []} patientContour={patientContour ?? []} />
          {(!patientContour || patientContour.length === 0) && (
            <Text style={s.vizHint}>Detailed pitch contour available after MIT therapy session</Text>
          )}
        </FadeInView>

        {/* Phonemes */}
        {typedResults.length > 0 && (
          <FadeInView delay={440} fromY={20} duration={460} style={s.card}>
            <Text style={s.cardTitle}>Phoneme Analysis</Text>
            <PhonemeChart wordResults={typedResults} weakPhonemes={weakPhonemes} />
          </FadeInView>
        )}
        {typedResults.length === 0 && weakPhonemes.length > 0 && (
          <FadeInView delay={440} fromY={20} duration={460} style={s.card}>
            <Text style={s.cardTitle}>Sounds to Practice</Text>
            <View style={s.phonemeRow}>
              {weakPhonemes.map((ph, i) => (
                <View key={i} style={s.phonemeBadge}><Text style={s.phonemeText}>/{ph}/</Text></View>
              ))}
            </View>
          </FadeInView>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <FadeInView delay={520} fromY={20} duration={460} style={s.card}>
            <Text style={s.cardTitle}>Recommendations</Text>
            {recommendations.map((rec, i) => (
              <FadeInView key={i} delay={580 + i * 60} fromY={8} duration={300} style={s.recItem}>
                <View style={[s.recBullet, { backgroundColor: colors.primary }]} />
                <Text style={s.recText}>{rec}</Text>
              </FadeInView>
            ))}
          </FadeInView>
        )}

        {/* Actions */}
        <FadeInView delay={640} fromY={16} duration={400} style={s.actions}>
          <AnimatedPressable style={s.primaryBtn} onPress={goHome}>
            <Text style={s.primaryBtnText}>Back to Home</Text>
          </AnimatedPressable>
          <AnimatedPressable style={s.secondaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Assessment' }] })}>
            <Text style={s.secondaryBtnText}>Try Again</Text>
          </AnimatedPressable>
        </FadeInView>
      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  banner:    { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.md },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  bannerSub:   { ...typography.body, color: colors.textSecondary, marginTop: 2, lineHeight: 22 },
  card:      { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.2 },
  scoreRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  subScores: { flex: 1, gap: spacing.md },
  subItem:   {},
  subItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  subLabel:  { ...typography.caption, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  subValue:  { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  feedbackBox:    { flexDirection: 'row', backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  feedbackAccent: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  feedbackText:   { ...typography.body, color: colors.text, lineHeight: 24, flex: 1 },
  vizHint:        { ...typography.caption, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic' },
  phonemeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  phonemeBadge: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.error + '60' },
  phonemeText:  { ...typography.body, color: colors.error, fontFamily: 'monospace' },
  recItem:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  recBullet: { width: 8, height: 8, borderRadius: 4, marginTop: 8, flexShrink: 0 },
  recText:   { ...typography.bodyLarge, color: colors.text, flex: 1, lineHeight: 28 },
  actions:          { gap: spacing.md, marginTop: spacing.sm },
  primaryBtn:       { backgroundColor: colors.primary, borderRadius: borderRadius.xl, paddingVertical: spacing.md, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.32, shadowRadius: 10, elevation: 5 },
  primaryBtnText:   { ...typography.button, color: '#fff', fontSize: 17 },
  secondaryBtn:     { paddingVertical: spacing.md, borderRadius: borderRadius.xl, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  secondaryBtnText: { ...typography.button, color: colors.textSecondary },
});
