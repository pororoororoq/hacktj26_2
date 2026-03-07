import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AuthContext } from '../navigation/AppNavigator';
import { getUser } from '../services/auth';
import { getProgressSummary, resetProgress, ProgressSummary } from '../services/api';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

export function ProfileScreen() {
  const { signOut } = useContext(AuthContext);
  const [userName, setUserName] = useState('');
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [user, summaryData] = await Promise.all([
        getUser(),
        getProgressSummary(),
      ]);
      setUserName(user?.name ?? '');
      setSummary(summaryData);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar / Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <Text style={styles.nameText}>{userName || 'User'}</Text>
        </View>

        {/* Stats Summary */}
        {summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Journey</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{summary.total_sessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(summary.total_practice_time_minutes)}m</Text>
                <Text style={styles.statLabel}>Practice Time</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{summary.words.mastered}</Text>
                <Text style={styles.statLabel}>Mastered</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{summary.streak_days}d</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={async () => {
              await resetProgress();
              fetchData();
            }}
          >
            <Text style={styles.settingsIcon}>🔄</Text>
            <Text style={styles.settingsText}>Reset Progress</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },

  avatarSection: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  nameText: { ...typography.h2, color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  settingsIcon: { fontSize: 20 },
  settingsText: { ...typography.body, color: colors.text },

  signOutButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  signOutText: { ...typography.button, color: '#fff' },
});
