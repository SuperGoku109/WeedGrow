import { gardenControls } from '@/design-system/tokens/garden';
import { growMotion } from '@/design-system/tokens/motion';
import React from 'react';
import { Animated, Easing, Platform, Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
export { useReducedMotion } from '@/hooks/useReducedMotion';
const nativeDriver = Platform.OS !== 'web';

/** Stop interrupted gestures and reset when a control becomes disabled or motion is reduced. */
export function usePressMotion(disabled = false) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  React.useEffect(() => {
    if (reduced || disabled) { scale.stopAnimation(); scale.setValue(1); }
    return () => scale.stopAnimation();
  }, [reduced, disabled, scale]);
  return {
    style: { transform: [{ scale }] },
    pressIn: () => {
      if (!reduced && !disabled) Animated.timing(scale, { toValue: growMotion.pressScale, duration: growMotion.pressDuration, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
    },
    pressOut: () => {
      if (!reduced && !disabled) Animated.spring(scale, { toValue: 1, ...growMotion.spring, useNativeDriver: nativeDriver }).start();
    },
  };
}
export function GrowReveal({ children, style, delay = 0, surface = false, ...props }: ViewProps & { delay?: number; surface?: boolean }) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduced) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: growMotion.revealDuration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [delay, reduced, value]);
  return <Animated.View {...props} style={[style, { opacity: value, transform: [{ scale: surface ? value.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) : 1 }, { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}
export function GrowPress({ children, style, containerStyle, hitSlop = gardenControls.hitSlop, ...props }: React.ComponentProps<typeof Pressable> & { containerStyle?: StyleProp<ViewStyle> }) {
  const motion = usePressMotion(!!props.disabled);
  return <Animated.View style={[containerStyle, motion.style]}><Pressable {...props} hitSlop={hitSlop} style={state => [{ minHeight: gardenControls.height, minWidth: gardenControls.height }, typeof style === 'function' ? style(state) : style]} onPressIn={event => { motion.pressIn(); props.onPressIn?.(event); }} onPressOut={event => { motion.pressOut(); props.onPressOut?.(event); }}>{children}</Pressable></Animated.View>;
}

/** Measure actual item positions, including unequal widths and RTL layout. */
export function useSelectionIndicator(selectedKey: string | number) {
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = React.useState<Record<string, { x: number; width: number }>>({});
  const x = React.useRef(new Animated.Value(0)).current;
  const width = React.useRef(new Animated.Value(0)).current;
  const positioned = React.useRef(false);
  const target = layouts[String(selectedKey)];
  React.useEffect(() => {
    if (!target) return;
    if (reduced || !positioned.current) {
      x.stopAnimation(); width.stopAnimation(); x.setValue(target.x); width.setValue(target.width); positioned.current = true;
      return;
    }
    const animation = Animated.parallel([
      Animated.spring(x, { toValue: target.x, ...growMotion.selectionSpring, useNativeDriver: false }),
      Animated.spring(width, { toValue: target.width, ...growMotion.selectionSpring, useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [target, reduced, x, width]);
  return {
    onItemLayout: (key: string | number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setLayouts(previous => previous[String(key)]?.x === x && previous[String(key)]?.width === width ? previous : { ...previous, [String(key)]: { x, width } });
    },
    indicatorStyle: { position: 'absolute' as const, left: 0, top: 4, bottom: 4, width, opacity: target ? 1 : 0, transform: [{ translateX: x }] },
  };
}

/** Keep closing content mounted until it folds away, but remove it from interaction immediately. */
export function GrowCollapse({ open, children }: { open: boolean; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = React.useState(open);
  const [measuredHeight, setMeasuredHeight] = React.useState(0);
  const height = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (open) setMounted(true);
    height.stopAnimation();
    if (reduced) { height.setValue(open ? measuredHeight : 0); if (!open) setMounted(false); return; }
    const animation = Animated.timing(height, { toValue: open ? measuredHeight : 0, duration: growMotion.expandDuration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished && !open) setMounted(false); });
    return () => animation.stop();
  }, [open, measuredHeight, reduced, height]);
  return <Animated.View aria-hidden={!open} pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={{ height, overflow: 'hidden' }}>
    {mounted && <View onLayout={event => setMeasuredHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>{children}</View>}
  </Animated.View>;
}

export function GrowRotate({ expanded, children }: { expanded: boolean; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(expanded ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduced) { value.stopAnimation(); value.setValue(expanded ? 1 : 0); return; }
    const animation = Animated.spring(value, { toValue: expanded ? 1 : 0, ...growMotion.selectionSpring, useNativeDriver: nativeDriver });
    animation.start(); return () => animation.stop();
  }, [expanded, reduced, value]);
  return <Animated.View style={{ transform: [{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>{children}</Animated.View>;
}

/** A single confirmation pop after a new success, never on loading an existing record. */
export function GrowConfirm({ confirmed, children }: { confirmed: boolean; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const previous = React.useRef(confirmed);
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const becameConfirmed = confirmed && !previous.current;
    previous.current = confirmed;
    if (reduced || !becameConfirmed) { scale.stopAnimation(); scale.setValue(1); return; }
    scale.setValue(0.72);
    const animation = Animated.spring(scale, { toValue: 1, ...growMotion.confirmationSpring, useNativeDriver: nativeDriver, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [confirmed, reduced, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

export function GrowTabIcon({ focused, children }: { focused: boolean; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduced) { value.stopAnimation(); value.setValue(0); return; }
    const animation = Animated.spring(value, { toValue: focused ? 1 : 0, ...growMotion.spring, useNativeDriver: nativeDriver });
    animation.start(); return () => animation.stop();
  }, [focused, reduced, value]);
  return <Animated.View style={{ transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }] }}>{children}</Animated.View>;
}
