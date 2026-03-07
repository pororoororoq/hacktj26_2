/**
 * PhonemeHeatmap
 *
 * Color-coded grid showing accuracy per phoneme.
 *   Green  ≥80 %   strong
 *   Yellow 60–79 % needs work
 *   Red    <60 %   weak
 *
 * Each cell also shows a trend arrow:
 *   ↑  improving    ↓  declining    →  stable
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

export interface PhonemeEntry {
  phoneme:      string;
  avg_accuracy: number;
  trend:        'improving' | 'stable' | 'declining';
  count:        number;
}

interface Props {
  phonemes: PhonemeEntry[];
}

function cellColor(acc: number): string {
  if (acc >= 80) return '#D4EDDA';   // light green
  if (acc >= 60) return '#FFF3CD';   // light yellow
  return '#F8D7DA';                  // light red
}

function textColor(acc: number): string {
  if (acc >= 80) return '#1A5C2A';
  if (acc >= 60) return '#7A5000';
  return '#842029';
}

function trendArrow(trend: string): string {
  if (trend === 'improving') return ' ↑';
  if (trend === 'declining') return ' ↓';
  return '';
}

function PhonemeCell({ entry }: { entry: PhonemeEntry }) {
  const bg   = cellColor(entry.avg_accuracy);
  const fg   = textColor(entry.avg_accuracy);
  const arrow = trendArrow(entry.trend);

  return (
    <View style={[styles.cell, { backgroundColor: bg }]}>
      <Text style={[styles.cellPhoneme, { color: fg }]}>/{entry.phoneme}/</Text>
      <Text style={[styles.cellScore,   { color: fg }]}>
        {entry.avg_accuracy}%{arrow}
      </Text>
    </View>
  );
}

export function PhonemeHeatmap({ phonemes }: Props) {
  if (phonemes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Complete assessments to see phoneme accuracy
        </Text>
      </View>
    );
  }

  // Split into strong / needs-work / weak sections
  const strong = phonemes.filter(p => p.avg_accuracy >= 80);
  const mid    = phonemes.filter(p => p.avg_accuracy >= 60 && p.avg_accuracy < 80);
  const weak   = phonemes.filter(p => p.avg_accuracy <  60);

  const Section = ({ title, data }: { title: string; data: PhonemeEntry[] }) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <View style={styles.grid}>
          {data.map(p => <PhonemeCell key={p.phoneme} entry={p} />)}
        </View>
      </View>
    );
  };

  return (
    <View>
      <Section title="Strong  (80%+)" data={strong} />
      <Section title="Needs Work  (60–79%)" data={mid} />
      <Section title="Focus Area  (<60%)" data={weak} />

      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: '#D4EDDA' }]} />
        <Text style={styles.legendText}>Strong</Text>
        <View style={[styles.legendDot, { backgroundColor: '#FFF3CD', marginLeft: spacing.sm }]} />
        <Text style={styles.legendText}>Needs Work</Text>
        <View style={[styles.legendDot, { backgroundColor: '#F8D7DA', marginLeft: spacing.sm }]} />
        <Text style={styles.legendText}>Focus</Text>
        <Text style={[styles.legendText, { marginLeft: spacing.sm }]}>↑ improving</Text>
        <Text style={[styles.legendText, { marginLeft: spacing.sm }]}>↓ declining</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  section: { marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  cell: {
    borderRadius: borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 58,
  },
  cellPhoneme: {
    fontSize: 13,
    fontWeight: '700',
  },
  cellScore: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  legendDot:  { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, color: colors.textSecondary },
});
