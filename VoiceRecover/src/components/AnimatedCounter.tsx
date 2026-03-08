/**
 * AnimatedCounter — Counts from 0 up to `value` on mount.
 * Great for score reveals and stat cards.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, TextStyle } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  delay?: number;
  decimals?: number;
  style?: StyleProp<TextStyle>;
}

export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  duration = 900,
  delay = 0,
  decimals = 0,
  style,
}: AnimatedCounterProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const displayRef = useRef<any>(null);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // must be false for non-transform/opacity
    }).start();
  }, [value]);

  const text = anim.interpolate({
    inputRange: [0, value === 0 ? 1 : value],
    outputRange: [
      `${prefix}0${suffix}`,
      `${prefix}${value.toFixed(decimals)}${suffix}`,
    ],
  });

  return (
    <Animated.Text style={style} ref={displayRef}>
      {text}
    </Animated.Text>
  );
}
