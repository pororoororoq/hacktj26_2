/**
 * StaggeredWords — Renders a string word-by-word, each word fading + sliding
 * in with a staggered delay.  Inspired by the cinematic text reveals on
 * sites like delightsnowparks.com.
 *
 * Usage:
 *   <StaggeredWords
 *     text="Your personal speech therapy companion"
 *     style={styles.subtitle}
 *     wordDelay={80}
 *     initialDelay={400}
 *   />
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, TextStyle, View } from 'react-native';

interface StaggeredWordsProps {
  text: string;
  /** Base delay before the first word appears (ms) */
  initialDelay?: number;
  /** Extra delay between each successive word (ms) */
  wordDelay?: number;
  /** Animation duration per word (ms) */
  duration?: number;
  /** Starting Y offset per word */
  fromY?: number;
  style?: StyleProp<TextStyle>;
}

function AnimatedWord({
  word,
  delay,
  duration,
  fromY,
  style,
}: {
  word: string;
  delay: number;
  duration: number;
  fromY: number;
  style?: StyleProp<TextStyle>;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const easing = Easing.out(Easing.quad);
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration, delay, easing, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, easing, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text style={[style, { opacity, transform: [{ translateY }] }]}>
      {word}{' '}
    </Animated.Text>
  );
}

export function StaggeredWords({
  text,
  initialDelay = 0,
  wordDelay = 70,
  duration = 400,
  fromY = 16,
  style,
}: StaggeredWordsProps) {
  const words = text.split(' ');
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {words.map((word, i) => (
        <AnimatedWord
          key={`${word}-${i}`}
          word={word}
          delay={initialDelay + i * wordDelay}
          duration={duration}
          fromY={fromY}
          style={style}
        />
      ))}
    </View>
  );
}
