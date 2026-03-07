import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Disclaimer } from '../components/Disclaimer';
import { FadeInView } from '../components/FadeInView';
import { StaggeredWords } from '../components/StaggeredWords';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { getDailyMissions, Mission } from '../services/api';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type Nav = StackNavigationProp<RootStackParamList, 'Welcome'>;

// ── Animated mission row ────────────────────────────────────────────────────

function MissionRow({ mission, delay }: { mission: Mission; delay: number }) {
  return (
    <FadeInView delay={delay} fromY={20} duration={420} style={[mStyles.row, mission.completed && mStyles.rowCompleted]}>
      <Text style={mStyles.icon}>{mission.completed ? '\u2705' : mission.icon}</Text>
      <View style={mStyles.info}>
        <Text style={[mStyles.title, mission.completed && mStyles.titleDone]}>{mission.title}</Text>
        <Text style={mStyles.desc}>{mission.description}</Text>
      </View>
      <View style={mStyles.xpBadge}>
        <Text style={mStyles.xpText}>+{mission.xp}</Text>
      </View>
    </FadeInView>
  );
}

const mStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rowCompleted: { opacity: 0.55 },
  icon:  { fontSize: 24, marginRight: spacing.md, width: 30, textAlign: 'center' },
  info:  { flex: 1 },
  title: { ...typography.body, fontWeight: '600', color: colors.text },
  titleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  desc:  { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  xpBadge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  xpText: { ...typography.caption, color: '#fff', fontWeight: '700', fontSize: 11 },
});

// ── Pulsing emoji ─────────────────────────────────────────────────────────────

function PulsingEmoji() {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.Text style={[styles.emoji, { transform: [{ scale }], opacity }]}>
      {'\uD83C\uDFB5'}
    </Animated.Text>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoadingMissions(true);
        try {
          const m = await getDailyMissions();
          if (!cancelled) setMissions(m);
        } catch {}
        if (!cancelled) setLoadingMissions(false);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const completedCount = missions.filter(m => m.completed).length;
  const totalXp = missions.filter(m => m.completed).reduce((s, m) => s + m.xp, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <PulsingEmoji />

          {/* Title — staggered word-by-word reveal */}
          <StaggeredWords
            text="VoiceRecover"
            initialDelay={180}
            wordDelay={0}
            duration={500}
            fromY={20}
            style={styles.titleWord}
          />

          {/* Subtitle — staggered words after title finishes */}
          <View style={styles.subtitleRow}>
            <StaggeredWords
              text="Your personal speech therapy companion"
              initialDelay={420}
              wordDelay={60}
              duration={380}
              fromY={12}
              style={styles.subtitleWord}
            />
          </View>
        </View>

        {/* ── Primary CTA ──────────────────────────────── */}
        <FadeInView delay={700} fromY={30} duration={480}>
          <AnimatedPressable
            style={styles.button}
            onPress={() => navigation.getParent()?.navigate('ExerciseTab')}
          >
            <Text style={styles.buttonText}>Start Session</Text>
          </AnimatedPressable>
        </FadeInView>

        {/* ── Challenge button ─────────────────────────── */}
        <FadeInView delay={820} fromY={24} duration={460}>
          <AnimatedPressable
            style={styles.challengeButton}
            onPress={() => navigation.navigate('Challenge')}
          >
            <Text style={styles.challengeIcon}>{'\uD83D\uDD25'}</Text>
            <Text style={styles.challengeText}>Challenge Mode</Text>
          </AnimatedPressable>
        </FadeInView>

        {/* ── Daily Missions ───────────────────────────── */}
        <FadeInView delay={960} fromY={20} duration={440} style={styles.missionsSection}>
          <View style={styles.missionsHeader}>
            <Text style={styles.missionsTitle}>Daily Missions</Text>
            {missions.length > 0 && (
              <Text style={styles.missionsCount}>{completedCount}/{missions.length}</Text>
            )}
          </View>

          {loadingMissions ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : missions.length === 0 ? (
            <Text style={styles.noMissions}>Start a session to unlock missions!</Text>
          ) : (
            <>
              {missions.map((m, idx) => (
                <MissionRow key={m.id} mission={m} delay={1080 + idx * 70} />
              ))}
              {totalXp > 0 && (
                <FadeInView delay={1080 + missions.length * 70} fromY={8}>
                  <Text style={styles.xpTotal}>{'\uD83C\uDFC5'} {totalXp} XP earned today</Text>
                </FadeInView>
              )}
            </>
          )}
        </FadeInView>

      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },

  // Hero
  heroSection: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
  emoji: { fontSize: 56, marginBottom: spacing.md },

  // Staggered title words displayed inline
  titleWord: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },

  subtitleRow: { marginTop: spacing.xs },
  subtitleWord: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '400',
    lineHeight: 22,
  },

  // Main button
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: { ...typography.button, color: colors.surface, fontSize: 18 },

  // Challenge button
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  challengeIcon: { fontSize: 18 },
  challengeText: { ...typography.button, color: colors.primary },

  // Missions
  missionsSection: { marginTop: spacing.sm },
  missionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  missionsTitle: { ...typography.h3, color: colors.text },
  missionsCount: { ...typography.body, color: colors.primary, fontWeight: '700' },
  noMissions: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  xpTotal: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
