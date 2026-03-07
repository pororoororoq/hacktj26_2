/**
 * AnimatedPressable — A TouchableOpacity that scales down slightly on press,
 * giving tactile, fluid feedback like high-end web UIs.
 *
 * Usage:
 *   <AnimatedPressable style={styles.button} onPress={handlePress}>
 *     <Text>Press me</Text>
 *   </AnimatedPressable>
 */

import React, { useRef } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  StyleProp,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';

interface AnimatedPressableProps {
  onPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  children: React.ReactNode;
}

export function AnimatedPressable({
  onPress,
  style,
  disabled = false,
  scaleTo = 0.96,
  children,
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: scaleTo,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : pressIn}
      onPressOut={disabled ? undefined : pressOut}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale }], opacity: disabled ? 0.6 : 1 },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
