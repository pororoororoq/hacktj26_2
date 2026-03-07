import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Disclaimer } from '../components/Disclaimer';
import { getProgressSummary, ProgressSummary } from '../services/api';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// ─── Stat Card Component ────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

// ─── Difficulty Bar ─────────────────────────────────────────────────────────

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

// ─── ProgressScreen ─────────────────────────────────────────────────────────

export function ProgressScreen() {
  const navigation = useNavigation();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await getProgressSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError('Could not load progress. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProgress();
  }, [fetchProgress]);

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
          <TouchableOpacity style={styles.retryButton} onPress={fetchProgress}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const diffKeys = Object.keys(summary.difficulty_breakdown)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <Text style={styles.header}>Your Progress</Text>

        {/* Streak & Sessions */}
        <View style={styles.topStats}>
          <StatCard
            label="Day Streak"
            value={summary.streak_days > 0 ? `${summary.streak_days}` : '0'}
            sub={summary.streak_days > 0 ? 'Keep it up!' : 'Practice today!'}
          />
          <StatCard
            label="Sessions"
            value={summary.total_sessions}
          />
          <StatCard
            label="Time"
            value={`${Math.round(summary.total_practice_time_minutes)}m`}
            sub="total practice"
          />
        </View>

        {/* Current Level */}
        <View style={styles.levelCard}>
          <Text style={styles.levelTitle}>Current Level</Text>
          <Text style={styles.levelValue}>{summary.current_difficulty}</Text>
          <Text style={styles.levelSub}>
            {'★'.repeat(summary.current_difficulty)}{'☆'.repeat(5 - summary.current_difficulty)}
          </Text>
        </View>

        {/* Word Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Word Practice</Text>
          <View style={styles.statsRow}>
            <StatCard label="Unlocked" value={`${summary.words.unlocked}/${summary.words.total}`} />
            <StatCard label="Practiced" value={summary.words.practiced} />
            <StatCard label="Mastered" value={summary.words.mastered} />
          </View>
          {summary.words.avg_score > 0 && (
            <View style={styles.avgScoreRow}>
              <Text style={styles.avgLabel}>Average Score</Text>
              <Text style={[styles.avgValue, { color: summary.words.avg_score >= 70 ? colors.success : colors.warning }]}>
                {summary.words.avg_score}%
              </Text>
            </View>
          )}
        </View>

        {/* Phrase Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Melody Practice</Text>
          <View style={styles.statsRow}>
            <StatCard label="Unlocked" value={`${summary.phrases.unlocked}/${summary.phrases.total}`} />
            <StatCard label="Practiced" value={summary.phrases.practiced} />
          </View>
          {summary.phrases.avg_score > 0 && (
            <View style={styles.avgScoreRow}>
              <Text style={styles.avgLabel}>Average Score</Text>
              <Text style={[styles.avgValue, { color: summary.phrases.avg_score >= 70 ? colors.success : colors.warning }]}>
                {summary.phrases.avg_score}%
              </Text>
            </View>
          )}
        </View>

        {/* Difficulty Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty Levels</Text>
          {diffKeys.map(level => {
            const d = summary.difficulty_breakdown[level.toString()];
            return (
              <DifficultyBar key={level} level={level} mastered={d.mastered} total={d.total} />
            );
          })}
        </View>

        {/* Weak Phonemes */}
        {summary.weak_phonemes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Areas to Improve</Text>
            <View style={styles.phonemeGrid}>
              {summary.weak_phonemes.map((wp, i) => (
                <View key={i} style={styles.phonemeChip}>
                  <Text style={styles.phonemeText}>/{wp.phoneme}/</Text>
                  <Text style={styles.phonemeScore}>{wp.avg_accuracy}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.screenPadding },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  header: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  retryText: { ...typography.button, color: colors.surface },

  // Top stats row
  topStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },

  // Level card
  levelCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  levelTitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 56,
  },
  levelSub: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // Average score
  avgScoreRow: {
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

  // Difficulty bars
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  diffLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 55,
  },
  diffBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  diffBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  diffCount: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 35,
    textAlign: 'right',
  },

  // Phoneme chips
  phonemeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phonemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFF0F0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  phonemeText: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
  },
  phonemeScore: {
    ...typography.caption,
    color: colors.error,
  },

  // Back button
  backButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  backText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
