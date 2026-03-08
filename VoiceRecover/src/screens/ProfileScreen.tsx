import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../navigation/AppNavigator';
import { getUser } from '../services/auth';
import { getProgressSummary, resetProgress, ProgressSummary } from '../services/api';
import { FadeInView } from '../components/FadeInView';
import { AnimatedProgressBar } from '../components/AnimatedProgressBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// ── Animated stat card ────────────────────────────────────────────────────────

function StatCard({ value, label, suffix = '', color = colors.primary, delay = 0 }: {
  value: number | string; label: string; suffix?: string; color?: string; delay?: number;
}) {
  const countAnim = useRef(new Animated.Value(0)).current;
  const numValue  = typeof value === 'number' ? value : 0;

  useEffect(() => {
    countAnim.setValue(0);
    Animated.timing(countAnim, {
      toValue: numValue,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [numValue]);

  const displayStr = countAnim.interpolate({
    inputRange: [0, numValue === 0 ? 1 : numValue],
    outputRange: ['0', String(numValue)],
  });

  return (
    <FadeInView delay={delay} fromY={16} duration={400} style={statStyles.card}>
      <View style={[statStyles.dot, { backgroundColor: color + '22' }]}>
        <View style={[statStyles.dotInner, { backgroundColor: color }]} />
      </View>
      {typeof value === 'number' ? (
        <Animated.Text style={[statStyles.value, { color }]}>{displayStr as any}{suffix}</Animated.Text>
      ) : (
        <Text style={[statStyles.value, { color }]}>{value}</Text>
      )}
      <Text style={statStyles.label}>{label}</Text>
    </FadeInView>
  );
}

const statStyles = StyleSheet.create({
  card:     { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  dot:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  value:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label:    { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
});

// ── Achievement badge ─────────────────────────────────────────────────────────

function AchievementBadge({ icon, label, earned }: { icon: string; label: string; earned: boolean }) {
  return (
    <View style={[achStyles.badge, !earned && achStyles.badgeLocked]}>
      <Text style={achStyles.icon}>{icon}</Text>
      <Text style={[achStyles.label, !earned && achStyles.labelLocked]}>{label}</Text>
    </View>
  );
}

const achStyles = StyleSheet.create({
  badge:       { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, width: 80 },
  badgeLocked: { opacity: 0.35 },
  icon:        { fontSize: 26, marginBottom: 4 },
  label:       { fontSize: 9, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', lineHeight: 13 },
  labelLocked: { color: colors.textLight },
});

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({ icon, label, onPress, danger = false }: { icon: string; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={settingStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[settingStyles.iconBox, danger && settingStyles.iconBoxDanger]}>
        <Text style={settingStyles.icon}>{icon}</Text>
      </View>
      <Text style={[settingStyles.label, danger && settingStyles.labelDanger]}>{label}</Text>
      <Text style={settingStyles.chevron}>{'\u203A'}</Text>
    </TouchableOpacity>
  );
}

const settingStyles = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBox:       { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  iconBoxDanger: { backgroundColor: colors.errorBg },
  icon:          { fontSize: 18 },
  label:         { ...typography.body, color: colors.text, flex: 1 },
  labelDanger:   { color: colors.error },
  chevron:       { fontSize: 22, color: colors.textLight, fontWeight: '300' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const { signOut } = useContext(AuthContext);
  const [userName, setUserName] = useState('');
  const [summary,  setSummary]  = useState<ProgressSummary | null>(null);
  const [loading,  setLoading]  = useState(true);

  const avatarScale   = useRef(new Animated.Value(0.7)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [user, summaryData] = await Promise.all([getUser(), getProgressSummary()]);
      setUserName(user?.name ?? '');
      setSummary(summaryData);
    } catch {}
    setLoading(false);
    Animated.parallel([
      Animated.spring(avatarScale,   { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(avatarOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  useFocusEffect(React.useCallback(() => {
    setLoading(true);
    avatarScale.setValue(0.7);
    avatarOpacity.setValue(0);
    fetchData();
  }, [fetchData]));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const mastered   = summary?.words?.mastered  ?? 0;
  const practiced  = summary?.words?.practiced ?? 0;
  const masteryPct = practiced > 0 ? Math.round((mastered / practiced) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Profile" />

        {/* ── Avatar ──────────────────────────────────── */}
        <Animated.View style={[styles.avatarSection, { transform: [{ scale: avatarScale }], opacity: avatarOpacity }]}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName ? userName.charAt(0).toUpperCase() : '?'}</Text>
            </View>
          </View>
          <Text style={styles.nameText}>{userName || 'User'}</Text>
          {summary && summary.streak_days > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>{'\uD83D\uDD25'} {summary.streak_days}-day streak</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Stats ────────────────────────────────────── */}
        {summary && (
          <View style={styles.statsRow}>
            <StatCard value={summary.total_sessions}                          label="Sessions"  color={colors.primary}   delay={200} />
            <StatCard value={Math.round(summary.total_practice_time_minutes)} label="Minutes"   color={colors.secondary} delay={280} suffix="m" />
            <StatCard value={summary.words.mastered}                          label="Mastered"  color={colors.success}   delay={360} />
            <StatCard value={summary.streak_days}                             label="Streak"    color={colors.accent}    delay={440} suffix="d" />
          </View>
        )}

        {/* ── Mastery bar ───────────────────────────────── */}
        {summary && practiced > 0 && (
          <FadeInView delay={480} fromY={16} style={styles.card}>
            <Text style={styles.cardTitle}>Word Mastery</Text>
            <View style={styles.masteryHeader}>
              <Text style={styles.masteryFrac}>{mastered} of {practiced} words</Text>
              <Text style={[styles.masteryPct, { color: masteryPct >= 60 ? colors.success : colors.primary }]}>{masteryPct}%</Text>
            </View>
            <AnimatedProgressBar progress={masteryPct} delay={600} height={10} />
          </FadeInView>
        )}

        {/* ── Achievements ──────────────────────────────── */}
        <FadeInView delay={540} fromY={16} style={styles.card}>
          <Text style={styles.cardTitle}>Achievements</Text>
          <View style={styles.achRow}>
            <AchievementBadge icon={'\uD83C\uDFC6'} label="First Session"   earned={(summary?.total_sessions ?? 0) >= 1} />
            <AchievementBadge icon={'\uD83D\uDD25'} label="3-Day Streak"    earned={(summary?.streak_days ?? 0) >= 3} />
            <AchievementBadge icon={'\u2B50'}       label="10 Mastered"     earned={(summary?.words?.mastered ?? 0) >= 10} />
            <AchievementBadge icon={'\uD83D\uDCA1'} label="30 Min Practice" earned={(summary?.total_practice_time_minutes ?? 0) >= 30} />
          </View>
        </FadeInView>

        {/* ── Settings ──────────────────────────────────── */}
        <FadeInView delay={620} fromY={16} style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <SettingsRow
            icon={'\uD83D\uDD04'} label="Reset Progress" danger
            onPress={() => Alert.alert('Reset Progress', 'This will clear all your progress. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: async () => { await resetProgress(); fetchData(); } },
            ])}
          />
          <SettingsRow
            icon={'\uD83D\uDEAA'} label="Sign Out" danger
            onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ])}
          />
        </FadeInView>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:    { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xl },

  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: colors.primary + '40', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10 },
  avatarText:  { fontSize: 40, fontWeight: '800', color: '#fff' },
  nameText:    { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  streakBadge: { marginTop: spacing.xs, backgroundColor: colors.warningBg, borderRadius: borderRadius.full, paddingVertical: 4, paddingHorizontal: spacing.md },
  streakText:  { fontSize: 13, fontWeight: '700', color: colors.accent },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.2 },

  masteryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  masteryFrac:   { ...typography.body, color: colors.textSecondary },
  masteryPct:    { fontSize: 20, fontWeight: '800' },

  achRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
});
