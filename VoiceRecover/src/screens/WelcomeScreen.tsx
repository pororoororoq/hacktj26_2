import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Disclaimer } from '../components/Disclaimer';
import { getDailyMissions, Mission } from '../services/api';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type Nav = StackNavigationProp<RootStackParamList, 'Welcome'>;

function MissionRow({ mission }: { mission: Mission }) {
  return (
    <View style={[mStyles.row, mission.completed && mStyles.rowCompleted]}>
      <Text style={mStyles.icon}>{mission.completed ? '✅' : mission.icon}</Text>
      <View style={mStyles.info}>
        <Text style={[mStyles.title, mission.completed && mStyles.titleDone]}>{mission.title}</Text>
        <Text style={mStyles.desc}>{mission.description}</Text>
      </View>
      <View style={mStyles.xpBadge}>
        <Text style={mStyles.xpText}>+{mission.xp}</Text>
      </View>
    </View>
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rowCompleted: { opacity: 0.6 },
  icon: { fontSize: 24, marginRight: spacing.md, width: 30, textAlign: 'center' },
  info: { flex: 1 },
  title: { ...typography.body, fontWeight: '600', color: colors.text },
  titleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  desc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  xpBadge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  xpText: { ...typography.caption, color: '#fff', fontWeight: '700', fontSize: 11 },
});

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);

  // Refresh missions every time the screen is focused
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
        <View style={styles.heroSection}>
          <Text style={styles.emoji}>🎵</Text>
          <Text style={styles.title}>VoiceRecover</Text>
          <Text style={styles.subtitle}>Your personal speech therapy companion</Text>
        </View>

        {/* Action buttons */}
        <TouchableOpacity style={styles.button} onPress={() => navigation.getParent()?.navigate('ExerciseTab')}>
          <Text style={styles.buttonText}>Start Session</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.challengeButton} onPress={() => navigation.navigate('Challenge')}>
          <Text style={styles.challengeIcon}>🔥</Text>
          <Text style={styles.challengeText}>Challenge Mode</Text>
        </TouchableOpacity>

        {/* Daily Missions */}
        <View style={styles.missionsSection}>
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
              {missions.map(m => <MissionRow key={m.id} mission={m} />)}
              {totalXp > 0 && (
                <Text style={styles.xpTotal}>🏅 {totalXp} XP earned today</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  heroSection: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  // Main button
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  },
  challengeIcon: { fontSize: 18 },
  challengeText: { ...typography.button, color: colors.primary },

  // Missions
  missionsSection: { marginTop: spacing.sm },
  missionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  missionsTitle: { ...typography.h3, color: colors.text },
  missionsCount: { ...typography.body, color: colors.primary, fontWeight: '700' },
  noMissions: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.md },
  xpTotal: { ...typography.body, color: colors.accent, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
});
