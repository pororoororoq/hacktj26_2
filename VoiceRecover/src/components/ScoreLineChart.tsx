/**
 * ScoreLineChart
 *
 * SVG line chart (react-native-svg) displaying session score history.
 * Two lines: word-assessment scores (coral) and melody scores (blue).
 *
 * X-axis: session dates
 * Y-axis: 0–100 score
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { G, Line, Polyline, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export interface SessionPoint {
  date: string;         // "YYYY-MM-DD"
  type: 'assessment' | 'melody';
  avg_score: number;    // 0–100
}

interface Props {
  sessions: SessionPoint[];
}

const PAD   = { top: 12, bottom: 32, left: 36, right: 12 };
const H     = 180;
const GRID  = [0, 25, 50, 75, 100];

export function ScoreLineChart({ sessions }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // account for the screen-level horizontal padding (typically 16*2)
  const totalWidth = screenWidth - spacing.screenPadding * 2;
  const innerW     = totalWidth - PAD.left - PAD.right;
  const innerH     = H - PAD.top - PAD.bottom;

  const assessment = sessions.filter(s => s.type === 'assessment').sort((a, b) => a.date.localeCompare(b.date));
  const melody     = sessions.filter(s => s.type === 'melody').sort((a, b) => a.date.localeCompare(b.date));

  if (sessions.length === 0) {
    return (
      <View style={[styles.empty, { height: H }]}>
        <Text style={styles.emptyText}>Complete sessions to see your score trend</Text>
      </View>
    );
  }

  // Build sorted unique dates for X axis
  const allDates = [...new Set(sessions.map(s => s.date))].sort();
  const xOf = (date: string) => {
    const idx = allDates.indexOf(date);
    return allDates.length === 1 ? innerW / 2 : (idx / (allDates.length - 1)) * innerW;
  };
  const yOf = (score: number) => innerH - (score / 100) * innerH;

  const toPoints = (pts: SessionPoint[]) =>
    pts.map(p => `${xOf(p.date)},${yOf(p.avg_score)}`).join(' ');

  // Show up to 5 date labels evenly
  const labelStep  = Math.max(1, Math.ceil(allDates.length / 5));
  const labelDates = allDates.filter((_, i) => i % labelStep === 0 || i === allDates.length - 1);

  const assessPts = toPoints(assessment);
  const melodyPts = toPoints(melody);

  return (
    <View>
      <Svg width={totalWidth} height={H}>
        {/* Background */}
        <Rect x={0} y={0} width={totalWidth} height={H} fill="transparent" />

        <G x={PAD.left} y={PAD.top}>
          {/* Grid lines + Y labels */}
          {GRID.map(g => (
            <G key={g}>
              <Line
                x1={0} y1={yOf(g)} x2={innerW} y2={yOf(g)}
                stroke={g === 0 ? colors.border : colors.surfaceElevated}
                strokeWidth={g === 0 ? 1.5 : 1}
                strokeDasharray={g === 0 || g === 100 ? undefined : '4 3'}
              />
              <SvgText
                x={-4} y={yOf(g) + 4}
                fontSize={9} fill={colors.textLight} textAnchor="end"
              >
                {g}
              </SvgText>
            </G>
          ))}

          {/* Assessment line + dots */}
          {assessPts.length > 0 && (
            <>
              <Polyline
                points={assessPts}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {assessment.map((p, i) => (
                <Circle
                  key={`a${i}`}
                  cx={xOf(p.date)} cy={yOf(p.avg_score)}
                  r={4} fill={colors.primary}
                />
              ))}
            </>
          )}

          {/* Melody line + dots */}
          {melodyPts.length > 0 && (
            <>
              <Polyline
                points={melodyPts}
                fill="none"
                stroke={colors.secondary}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {melody.map((p, i) => (
                <Circle
                  key={`m${i}`}
                  cx={xOf(p.date)} cy={yOf(p.avg_score)}
                  r={4} fill={colors.secondary}
                />
              ))}
            </>
          )}

          {/* X-axis date labels */}
          {labelDates.map(date => {
            const [, mm, dd] = date.split('-');
            return (
              <SvgText
                key={date}
                x={xOf(date)} y={innerH + 22}
                fontSize={9} fill={colors.textLight} textAnchor="middle"
              >
                {`${parseInt(mm)}/${parseInt(dd)}`}
              </SvgText>
            );
          })}
        </G>
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {assessment.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendLabel}>Word</Text>
          </View>
        )}
        {melody.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
            <Text style={styles.legendLabel}>Melody</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
