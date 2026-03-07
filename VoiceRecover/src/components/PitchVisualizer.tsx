import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PitchPoint, DeviationRegion } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface Props {
  targetContour: PitchPoint[];
  patientContour: PitchPoint[];
  deviationRegions?: DeviationRegion[];
  width?: number;
  height?: number;
}

const DOT_SIZE = 8;

function normalize(points: PitchPoint[], minHz: number, maxHz: number): Array<{ time: number; normFreq: number }> {
  const range = maxHz - minHz || 1;
  return points.map((p) => ({
    time: p.time,
    normFreq: (p.frequency - minHz) / range,
  }));
}

export function PitchVisualizer({
  targetContour,
  patientContour,
  deviationRegions = [],
  width = 300,
  height = 100,
}: Props) {
  const { normTarget, normPatient, duration } = useMemo(() => {
    const allFreqs = [...targetContour, ...patientContour].map((p) => p.frequency);
    const minHz = allFreqs.length > 0 ? Math.min(...allFreqs) : 0;
    const maxHz = allFreqs.length > 0 ? Math.max(...allFreqs) : 1;

    const allTimes = [...targetContour, ...patientContour].map((p) => p.time);
    const dur = allTimes.length > 0 ? Math.max(...allTimes) : 1;

    return {
      normTarget: normalize(targetContour, minHz, maxHz),
      normPatient: normalize(patientContour, minHz, maxHz),
      duration: dur || 1,
    };
  }, [targetContour, patientContour]);

  return (
    <View style={styles.wrapper}>
      {/* Visualization area */}
      <View style={[styles.canvas, { width, height: height + DOT_SIZE }]}>
        {/* Deviation regions (background highlight) */}
        {deviationRegions.map((region, i) => {
          const left = (region.start / duration) * width;
          const regionWidth = ((region.end - region.start) / duration) * width;
          return (
            <View
              key={i}
              style={[
                styles.deviationRegion,
                { left, width: regionWidth, height: height + DOT_SIZE },
              ]}
            />
          );
        })}

        {/* Target contour dots — semi-transparent blue */}
        {normTarget.map((pt, i) => {
          const x = (pt.time / duration) * width;
          const y = height - pt.normFreq * height;
          return (
            <View
              key={`target-${i}`}
              style={[
                styles.dot,
                {
                  left: x - DOT_SIZE / 2,
                  top: y,
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: DOT_SIZE / 2,
                  backgroundColor: colors.secondary,
                  opacity: 0.45,
                },
              ]}
            />
          );
        })}

        {/* Patient contour dots — coral */}
        {normPatient.map((pt, i) => {
          const x = (pt.time / duration) * width;
          const y = height - pt.normFreq * height;
          return (
            <View
              key={`patient-${i}`}
              style={[
                styles.dot,
                {
                  left: x - 4,
                  top: y - 1,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.pitchPatient,
                  opacity: 0.9,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.secondary, opacity: 0.7 }]} />
          <Text style={styles.legendText}>Target</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.pitchPatient }]} />
          <Text style={styles.legendText}>Your Pitch</Text>
        </View>
        {deviationRegions.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFD0C0', borderWidth: 1, borderColor: colors.warning }]} />
            <Text style={styles.legendText}>Deviation</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.pitchBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  canvas: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  dot: {
    position: 'absolute',
  },
  deviationRegion: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(255, 100, 60, 0.12)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 100, 60, 0.25)',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
