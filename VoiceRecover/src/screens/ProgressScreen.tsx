import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Disclaimer } from '../components/Disclaimer';
import { ScoreLineChart, SessionPoint } from '../components/ScoreLineChart';
import { PhonemeHeatmap, PhonemeEntry } from '../components/PhonemeHeatmap';
import { SyllableHeatmap, SyllableReport } from '../components/SyllableHeatmap';
import { getProgressSummary, getScoreHistory, getPhonemeHistory, getSyllableReport, ProgressSummary } from '../services/api';
import { getUser } from '../services/auth';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

// ── Weekly Bar Chart (pure View) ─────────────────────────────────────────────

interface WeekDay { date: string; label: string; count: number }

function WeeklyBars({ days }: { days: WeekDay[] }) {
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const BAR_MAX  = 52;

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);

  return (
    <View style={bars.container}>
      {days.map(day => {
        const height  = Math.max((day.count / maxCount) * BAR_MAX, day.count > 0 ? 8 : 3);
        const isToday = day.label === todayLabel;
        return (
          <View key={day.date} style={bars.col}>
            <Text style={bars.count}>{day.count > 0 ? day.count : ''}</Text>
            <View style={bars.track}>
              <View style={[
                bars.fill,
                isToday && bars.fillToday,
                day.count === 0 && bars.fillEmpty,
                { height },
              ]} />
            </View>
            <Text style={[bars.dayLabel, isToday && bars.dayLabelToday]}>{day.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const bars = StyleSheet.create({
  container:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 86, paddingBottom: 20 },
  col:          { flex: 1, alignItems: 'center' },
  track:        { width: 22, justifyContent: 'flex-end', height: 52 },
  fill:         { width: 22, borderRadius: 5, backgroundColor: colors.primary, opacity: 0.65 },
  fillToday:    { opacity: 1 },
  fillEmpty:    { height: 3, backgroundColor: colors.border },
  count:        { fontSize: 10, color: colors.textSecondary, marginBottom: 2, fontWeight: '600', minHeight: 14 },
  dayLabel:     { fontSize: 10, color: colors.textSecondary, marginTop: 4 },
  dayLabelToday: { color: colors.primary, fontWeight: '700' },
});

// ── Difficulty Bar ───────────────────────────────────────────────────────────

function DifficultyBar({ level, mastered, total }: { level: number; mastered: number; total: number }) {
  const pct = total > 0 ? (mastered / total) * 100 : 0;
  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffLabel}>Level {level}</Text>
      <View style={styles.diffBarBg}>
        <View style={[styles.diffBarFill, { width: `${Math.min(pct, 100)}%` }]} />
      </View>
      <Text style={styles.diffCount}>{mastered}/{total}</Text>
    </View>
  );
}

// ── ProgressScreen ───────────────────────────────────────────────────────────

export function ProgressScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();

  const [summary,    setSummary]    = useState<ProgressSummary | null>(null);
  const [sessions,   setSessions]   = useState<SessionPoint[]>([]);
  const [weekly,     setWeekly]     = useState<WeekDay[]>([]);
  const [phonemes,   setPhonemes]   = useState<PhonemeEntry[]>([]);
  const [syllables,  setSyllables]  = useState<SyllableReport>({ positions: [], shapes: [], suggestions: [] });
  const [userName,   setUserName]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [summaryData, historyData, phonemeData, syllableData, user] = await Promise.all([
        getProgressSummary(),
        getScoreHistory(30),
        getPhonemeHistory(),
        getSyllableReport(),
        getUser(),
      ]);
      setSummary(summaryData);
      setSessions(historyData.sessions);
      setWeekly(historyData.weekly);
      setPhonemes(phonemeData.phonemes);
      setSyllables(syllableData);
      setUserName(user?.name ?? '');
      setError(null);

      // Syllable report is optional — don't let it break the whole page
      try {
        const syllableData = await getSyllableReport();
        setSyllables(syllableData);
      } catch {
        // Silently fail — syllable section will show empty state
      }
    } catch {
      setError('Could not load progress. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Something went wrong'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAll}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const diffKeys = Object.keys(summary.difficulty_breakdown).map(Number).sort((a, b) => a - b);

  // Compute overall improvement trend from session history
  const trendInfo = (() => {
    if (sessions.length < 4) return null;
    const mid    = Math.floor(sessions.length / 2);
    const first  = sessions.slice(0, mid).reduce((s, x) => s + x.avg_score, 0) / mid;
    const second = sessions.slice(mid).reduce((s, x) => s + x.avg_score, 0) / (sessions.length - mid);
    const diff   = Math.round(second - first);
    if (diff > 2)  return { label: `+${diff} pts trend`, color: colors.success };
    if (diff < -2) return { label: `${diff} pts trend`,  color: colors.error };
    return { label: 'Stable', color: colors.textSecondary };
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Progress</Text>
          {userName ? <Text style={styles.headerSub}>Hi, {userName}</Text> : null}
        </View>

        {/* Top Stats: 4 quick numbers */}
        <View style={styles.topStats}>
          <StatCard
            label="Streak"
            value={summary.streak_days > 0 ? `${summary.streak_days}d` : '0'}
            sub={summary.streak_days > 0 ? 'Keep it up!' : 'Start today'}
          />
          <StatCard label="Sessions" value={summary.total_sessions} />
          <StatCard
            label="Practice"
            value={`${Math.round(summary.total_practice_time_minutes)}m`}
            sub="total"
          />
          <StatCard label="Mastered" value={summary.words.mastered} sub="words" />
        </View>

        {/* ── Score Over Time (Line Chart) ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Score Over Time</Text>
            {trendInfo && (
              <Text style={[styles.trendBadge, { color: trendInfo.color }]}>{trendInfo.label}</Text>
            )}
          </View>
          <View style={styles.chartCard}>
            <ScoreLineChart sessions={sessions} />
          </View>
        </View>

        {/* ── Weekly Activity (Bar Chart) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.chartCard}>
            {weekly.length > 0
              ? <WeeklyBars days={weekly} />
              : <Text style={styles.noData}>No activity yet this week</Text>
            }
          </View>
        </View>

        {/* ── Phoneme Heatmap ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sound Accuracy</Text>
          <View style={styles.chartCard}>
            <PhonemeHeatmap phonemes={phonemes} />
          </View>
        </View>

        {/* ── Syllable Heatmap ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Syllable Analysis</Text>
          <View style={styles.chartCard}>
            <SyllableHeatmap report={syllables} />
          </View>
        </View>

        {/* ── Word Practice Stats ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Word Practice</Text>
          <View style={styles.statsRow}>
            <StatCard label="Unlocked"  value={`${summary.words.unlocked}/${summary.words.total}`} />
            <StatCard label="Practiced" value={summary.words.practiced} />
            <StatCard label="Mastered"  value={summary.words.mastered} />
          </View>
          {summary.words.avg_score > 0 && (
            <View style={styles.avgRow}>
              <Text style={styles.avgLabel}>Average Score</Text>
              <Text style={[styles.avgValue, { color: summary.words.avg_score >= 70 ? colors.success : colors.warning }]}>
                {summary.words.avg_score}%
              </Text>
            </View>
          )}
        </View>

        {/* ── Melody Practice Stats ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Melody Practice</Text>
          <View style={styles.statsRow}>
            <StatCard label="Unlocked"  value={`${summary.phrases.unlocked}/${summary.phrases.total}`} />
            <StatCard label="Practiced" value={summary.phrases.practiced} />
          </View>
          {summary.phrases.avg_score > 0 && (
            <View style={styles.avgRow}>
              <Text style={styles.avgLabel}>Average Score</Text>
              <Text style={[styles.avgValue, { color: summary.phrases.avg_score >= 70 ? colors.success : colors.warning }]}>
                {summary.phrases.avg_score}%
              </Text>
            </View>
          )}
        </View>

        {/* ── Difficulty Levels ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty Levels</Text>
          {diffKeys.map(level => {
            const d = summary.difficulty_breakdown[level.toString()];
            return <DifficultyBar key={level} level={level} mastered={d.mastered} total={d.total} />;
          })}
        </View>

        {/* ── Weak Phonemes quick list ── */}
        {summary.weak_phonemes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Focus Areas</Text>
            <Text style={styles.focusHint}>Tap a sound to start a drill</Text>
            <View style={styles.phonemeGrid}>
              {summary.weak_phonemes.map((wp, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.phonemeChip}
                  onPress={() => navigation.navigate('Drill', { phoneme: wp.phoneme })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.phonemeText}>/{wp.phoneme}/</Text>
                  <Text style={styles.phonemeScore}>{wp.avg_accuracy}%</Text>
                  <Text style={styles.phonemeArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.screenPadding },
  scroll:    { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },

  headerRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  header:    { ...typography.h2, color: colors.text },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorText:   { ...typography.body, color: colors.error, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  retryText: { ...typography.button, color: colors.surface },
  noData:    { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.md },

  topStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue:  { fontSize: 20, fontWeight: '700', color: colors.primary },
  statLabel:  { ...typography.caption, color: colors.textSecondary, marginTop: 1, textAlign: 'center' },
  statSub:    { ...typography.caption, color: colors.textSecondary, fontSize: 9, marginTop: 1 },

  section:         { marginBottom: spacing.lg },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:    { ...typography.h3, color: colors.text, marginBottom: 0 },
  trendBadge:      { fontSize: 12, fontWeight: '600' },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  avgLabel: { ...typography.body, color: colors.text },
  avgValue: { fontSize: 20, fontWeight: '700' },

  diffRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  diffLabel:  { ...typography.caption, color: colors.textSecondary, width: 55 },
  diffBarBg:  { flex: 1, height: 8, backgroundColor: colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  diffBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  diffCount:  { ...typography.caption, color: colors.textSecondary, width: 35, textAlign: 'right' },

  phonemeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  phonemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFF0F0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  focusHint:    { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  phonemeText:  { ...typography.body, color: colors.error, fontWeight: '600' },
  phonemeScore: { ...typography.caption, color: colors.error },
  phonemeArrow: { fontSize: 18, color: colors.error, fontWeight: '700', marginLeft: 2 },

});
