/**
 * FadeInView — Animated wrapper that fades in + slides up from below on mount.
 * Inspired by the staggered entrance animations on sites like delightsnowparks.com.
 *
 * Usage:
 *   <FadeInView delay={200} fromY={32}>
 *     <SomeContent />
 *   </FadeInView>
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface FadeInViewProps {
  /** Delay in ms before animation starts */
  delay?: number;
  /** Duration of the fade + slide animation in ms */
  duration?: number;
  /** Starting Y offset (px) — slides up to 0 */
  fromY?: number;
  /** Starting opacity (0–1) */
  fromOpacity?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function FadeInView({
  delay = 0,
  duration = 520,
  fromY = 28,
  fromOpacity = 0,
  style,
  children,
}: FadeInViewProps) {
  const opacity    = useRef(new Animated.Value(fromOpacity)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const easing = Easing.out(Easing.quad);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
