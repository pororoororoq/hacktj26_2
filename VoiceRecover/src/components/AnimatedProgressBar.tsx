/**
 * AnimatedProgressBar — Fills from 0 to `progress` (0–100) with a smooth
 * animation on mount. Supports custom colors and an optional label.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface AnimatedProgressBarProps {
  progress: number;     // 0–100
  color?: string;
  trackColor?: string;
  height?: number;
  delay?: number;
  duration?: number;
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

function getDefaultColor(progress: number): string {
  if (progress >= 80) return colors.success;
  if (progress >= 60) return colors.accent;
  return colors.primary;
}

export function AnimatedProgressBar({
  progress,
  color,
  trackColor = colors.border,
  height = 8,
  delay = 0,
  duration = 700,
  showLabel = false,
  style,
}: AnimatedProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const barColor = color ?? getDefaultColor(progress);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(Math.max(progress, 0), 100),
      duration,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={[style]}>
      <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              borderRadius: height,
              backgroundColor: barColor,
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: barColor }]}>{Math.round(progress)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  fill:  { position: 'absolute', left: 0, top: 0 },
  label: { ...typography.caption, fontWeight: '700', marginTop: 4, textAlign: 'right' },
});
