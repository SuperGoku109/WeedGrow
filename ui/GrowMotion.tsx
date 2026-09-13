import React from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ViewProps } from 'react-native';
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (active) setReduced(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}
export function GrowReveal({ children, style, delay = 0 }: ViewProps & { delay?: number }) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (reduced) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: 550, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, reduced, value]);
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>{children}</Animated.View>;
}
export function GrowPress({ children, style, ...props }: React.ComponentProps<typeof Pressable>) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const animate = (toValue: number) => Animated.spring(scale, { toValue, speed: 26, bounciness: 9, useNativeDriver: true }).start();
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable {...props} style={style} onPressIn={() => { if (!reduced) animate(0.95); }} onPressOut={() => animate(1)}>{children}</Pressable></Animated.View>;
}
