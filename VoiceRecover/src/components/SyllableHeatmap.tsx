/**
 * SyllableHeatmap
 *
 * Three-panel display:
 *  1. Position Accuracy  — Initial / Medial / Final syllable score cards
 *  2. Shape Accuracy     — CV pattern grid (CVC, CV, CCVC, …) color-coded
 *  3. Suggested Focus    — actionable cards with example words to practise
 *
 * Color scale (same as PhonemeHeatmap for visual consistency):
 *   Green  ≥80 %   Yellow  60–79 %   Red  <60 %
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyllablePosition {
  position:     'initial' | 'medial' | 'final';
  avg_accuracy: number;
  count:        number;
}

export interface SyllableShape {
  shape:        string;
  label:        string;
  avg_accuracy: number;
  count:        number;
}

export interface SyllableSuggestion {
  type:        string;
  title:       string;
  description: string;
  words:       string[];
}

export interface SyllableReport {
  positions:   SyllablePosition[];
  shapes:      SyllableShape[];
  suggestions: SyllableSuggestion[];
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function bgColor(acc: number): string {
  if (acc >= 80) return '#D4EDDA';
  if (acc >= 60) return '#FFF3CD';
  return '#F8D7DA';
}

function fgColor(acc: number): string {
  if (acc >= 80) return '#1A5C2A';
  if (acc >= 60) return '#7A5000';
  return '#842029';
}

function scoreLabel(acc: number): string {
  if (acc >= 80) return 'Strong';
  if (acc >= 60) return 'Needs Work';
  return 'Focus Area';
}

// ── Position card ─────────────────────────────────────────────────────────────

const POS_TITLES: Record<string, string> = {
  initial: 'First\nSyllable',
  medial:  'Middle\nSyllable',
  final:   'Last\nSyllable',
};

function PositionCard({ pos }: { pos: SyllablePosition }) {
  const bg = bgColor(pos.avg_accuracy);
  const fg = fgColor(pos.avg_accuracy);
  return (
    <View style={[pCard.card, { backgroundColor: bg }]}>
      <Text style={[pCard.pct, { color: fg }]}>{pos.avg_accuracy}%</Text>
      <Text style={[pCard.title, { color: fg }]}>
        {POS_TITLES[pos.position] ?? pos.position}
      </Text>
      <Text style={[pCard.badge, { color: fg }]}>{scoreLabel(pos.avg_accuracy)}</Text>
    </View>
  );
}

const pCard = StyleSheet.create({
  card:  { flex: 1, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center' },
  pct:   { fontSize: 26, fontWeight: '800' },
  title: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 3 },
  badge: { fontSize: 9,  marginTop: 2, fontStyle: 'italic' },
});

// ── Shape cell ────────────────────────────────────────────────────────────────

function ShapeCell({ s }: { s: SyllableShape }) {
  const bg = bgColor(s.avg_accuracy);
  const fg = fgColor(s.avg_accuracy);
  return (
    <View style={[sCell.cell, { backgroundColor: bg }]}>
      <Text style={[sCell.pattern, { color: fg }]}>{s.shape}</Text>
      <Text style={[sCell.label,   { color: fg }]}>{s.label}</Text>
      <Text style={[sCell.pct,     { color: fg }]}>{s.avg_accuracy}%</Text>
    </View>
  );
}

const sCell = StyleSheet.create({
  cell:    { borderRadius: borderRadius.md, padding: spacing.sm, minWidth: 96, alignItems: 'center', marginBottom: spacing.xs },
  pattern: { fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  label:   { fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 },
  pct:     { fontSize: 13, fontWeight: '700', marginTop: 3 },
});

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({ sug }: { sug: SyllableSuggestion }) {
  return (
    <View style={sugCard.card}>
      <Text style={sugCard.title}>{sug.title}</Text>
      <Text style={sugCard.desc}>{sug.description}</Text>
      <View style={sugCard.wordRow}>
        {sug.words.map(w => (
          <View key={w} style={sugCard.chip}>
            <Text style={sugCard.chipText}>{w}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sugCard = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  title:    { ...typography.body, fontWeight: '700', color: colors.text, marginBottom: 2 },
  desc:     { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  wordRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});

// ── Sub-section label ─────────────────────────────────────────────────────────

function SubLabel({ text, topGap = false }: { text: string; topGap?: boolean }) {
  return (
    <Text style={[sub.text, topGap && { marginTop: spacing.md }]}>{text}</Text>
  );
}

const sub = StyleSheet.create({
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
});

// ── Main component ────────────────────────────────────────────────────────────

export function SyllableHeatmap({ report }: { report: SyllableReport }) {
  const hasData = report.positions.length > 0 || report.shapes.length > 0;

  if (!hasData) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No syllable data yet</Text>
        <Text style={styles.emptyText}>
          Complete speech assessments to unlock a breakdown of which syllable
          positions and patterns you find hardest.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* 1 ── Syllable position accuracy */}
      {report.positions.length > 0 && (
        <>
          <SubLabel text="Position Accuracy" />
          <View style={styles.posRow}>
            {(['initial', 'medial', 'final'] as const).map(p => {
              const data = report.positions.find(r => r.position === p);
              return data ? <PositionCard key={p} pos={data} /> : null;
            })}
          </View>
        </>
      )}

      {/* 2 ── Syllable shape accuracy */}
      {report.shapes.length > 0 && (
        <>
          <SubLabel text="Syllable Shape Accuracy" topGap />
          <View style={styles.shapeGrid}>
            {report.shapes.map(s => <ShapeCell key={s.shape} s={s} />)}
          </View>
          <View style={styles.shapeLegend}>
            <Text style={styles.legendText}>C = consonant  ·  V = vowel  ·  sorted worst → best</Text>
          </View>
        </>
      )}

      {/* 3 ── Focus suggestions */}
      {report.suggestions.length > 0 && (
        <>
          <SubLabel text="Suggested Focus" topGap />
          {report.suggestions.map((sug, i) => (
            <SuggestionCard key={i} sug={sug} />
          ))}
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  posRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shapeLegend: { marginTop: spacing.xs },
  legendText:  { fontSize: 10, color: colors.textLight, fontStyle: 'italic' },
});
