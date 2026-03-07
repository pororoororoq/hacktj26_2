import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface Props {
  word: string;
  currentIndex: number;
  totalWords: number;
}

export function WordCard({ word, currentIndex, totalWords }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.progress}>Word {currentIndex + 1} of {totalWords}</Text>
      <Text style={styles.word}>{word}</Text>
      <Text style={styles.instruction}>Say this word clearly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.xl,
  },
  progress: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  word: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  instruction: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
