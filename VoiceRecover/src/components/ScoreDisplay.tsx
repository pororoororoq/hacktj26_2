import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface Props {
  score: number;
  label?: string;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.primary; // coral for low scores
}

export function ScoreDisplay({ score, label = 'Overall Score', size = 120 }: Props) {
  const scoreColor = getScoreColor(score);
  const displayScore = Math.round(score);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: scoreColor,
          },
        ]}
      >
        <Text style={[styles.scoreNumber, { color: scoreColor, fontSize: size * 0.35 }]}>
          {displayScore}
        </Text>
        <Text style={styles.percent}>%</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  circle: {
    borderWidth: 6,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  scoreNumber: {
    fontWeight: '700',
    lineHeight: undefined,
  },
  percent: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
