import React from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useReducedMotion } from './GrowMotion';

const tabPaths = new Set(['/', '/profiles', '/more']);
/** Native stacks own mobile transitions; this fills the same gap in the web preview. */
export default function RouteTransition({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  const previous = React.useRef(path);
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(1)).current;
  React.useLayoutEffect(() => {
    const tabChange = tabPaths.has(previous.current) && tabPaths.has(path);
    const changed = previous.current !== path;
    previous.current = path;
    if (Platform.OS !== 'web' || reduced || !changed || tabChange) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [path, reduced, value]);
  return <View testID="route-backdrop" style={{ flex: 1, backgroundColor: '#15231c' }}><Animated.View style={{ flex: 1, opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>{children}</Animated.View></View>;
}
