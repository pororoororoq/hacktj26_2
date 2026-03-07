import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PhonemeResult, WordResult } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface Props {
  wordResults: WordResult[];
  weakPhonemes: string[];
}

function getBarColor(accuracy: number): string {
  if (accuracy >= 70) return colors.phonemeOk;
  if (accuracy >= 50) return colors.phonemeMid;
  return colors.phonemeWeak;
}

function PhonemeBar({ result }: { result: PhonemeResult }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.phonemeLabel}>/{result.phoneme}/</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${result.accuracy}%`, backgroundColor: getBarColor(result.accuracy) }]} />
      </View>
      <Text style={[styles.barScore, { color: getBarColor(result.accuracy) }]}>{result.accuracy}%</Text>
    </View>
  );
}

export function PhonemeChart({ wordResults, weakPhonemes }: Props) {
  return (
    <View style={styles.container}>
      {wordResults.map((wr) => (
        <View key={wr.word} style={styles.wordSection}>
          <View style={styles.wordHeader}>
            <Text style={styles.wordLabel}>{wr.word}</Text>
            <Text style={[styles.wordScore, { color: getBarColor(wr.score) }]}>{wr.score}%</Text>
          </View>
          {wr.phonemes.map((p, i) => (
            <PhonemeBar key={`${wr.word}-${p.phoneme}-${i}`} result={p} />
          ))}
        </View>
      ))}
      {weakPhonemes.length > 0 && (
        <View style={styles.weakSection}>
          <Text style={styles.weakTitle}>Sounds to practice:</Text>
          <Text style={styles.weakList}>/{weakPhonemes.join('/, /')}/</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  wordSection: { marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md },
  wordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  wordLabel: { ...typography.h3, color: colors.text, textTransform: 'capitalize' },
  wordScore: { ...typography.h3 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, paddingVertical: 2 },
  phonemeLabel: { width: 40, ...typography.caption, color: colors.textSecondary, fontFamily: 'monospace' },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.surfaceElevated, borderRadius: 6, marginHorizontal: spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barScore: { width: 40, ...typography.caption, textAlign: 'right' },
  weakSection: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md },
  weakTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  weakList: { ...typography.body, color: colors.error, fontFamily: 'monospace' },
});
