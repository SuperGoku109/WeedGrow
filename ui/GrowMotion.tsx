import React from 'react';
import { Animated, Easing, Pressable, ViewProps } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { gardenLayout } from '@/design-system/tokens/garden';
export { useReducedMotion } from '@/hooks/useReducedMotion';
export function GrowReveal({ children, style, delay = 0 }: ViewProps & { delay?: number }) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduced) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: 220, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, reduced, value]);
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}
export function GrowPress({ children, style, ...props }: React.ComponentProps<typeof Pressable>) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const animate = (toValue: number) => Animated.spring(scale, { toValue, speed: 26, bounciness: 9, useNativeDriver: true }).start();
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable {...props} style={state => [{ minHeight: gardenLayout.touchTarget, minWidth: gardenLayout.touchTarget }, typeof style === 'function' ? style(state) : style]} onPressIn={event => { if (!reduced && !props.disabled) animate(0.98); props.onPressIn?.(event); }} onPressOut={event => { if (!reduced) animate(1); props.onPressOut?.(event); }}>{children}</Pressable></Animated.View>;
}
