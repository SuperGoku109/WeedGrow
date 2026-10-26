import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring, runOnJS } from 'react-native-reanimated';

interface RipplePulseProps {
  show: boolean;
  onAnimationEnd?: () => void;
  color?: string;
  duration?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const RipplePulse = ({ show, onAnimationEnd, color = '#4caf50', duration = 400, size = 120, style }: RipplePulseProps) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    if (show) {
      scale.value = 0;
      opacity.value = 0.3;
      scale.value = withSequence(
        withTiming(1.15, { duration: duration * 0.7 }),
        withSpring(1, { damping: 8, stiffness: 120 }, (finished) => {
          if (finished && onAnimationEnd) runOnJS(onAnimationEnd)();
        })
      );
      opacity.value = withTiming(0, { duration });
    }
  }, [show, duration, onAnimationEnd, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return show ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
        style,
      ]}
    />
  ) : null;
};

const styles = StyleSheet.create({
  ripple: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
});
