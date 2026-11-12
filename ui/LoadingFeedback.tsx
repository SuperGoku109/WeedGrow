import React from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Text, View, type ViewProps } from 'react-native';
import { gardenThemes, type GardenTheme } from '@/design-system/tokens/garden';
import { useReducedMotion } from './GrowMotion';

/** A quiet breathing placeholder; stops after three cycles on slow connections. */
export function LoadingPulse({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (reduced) { value.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.45, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(value, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]), { iterations: 3 });
    animation.start(); return () => animation.stop();
  }, [reduced, value]);
  return <Animated.View {...props} accessible={false} accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants" style={[style, { opacity: value }]}>{children}</Animated.View>;
}
export function PendingStatus({ label, theme: t = gardenThemes.grove }: { label: string; theme?: GardenTheme }) {
  return <View accessibilityState={{ busy: true }} style={{ backgroundColor: t.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <ActivityIndicator size="small" color={t.accent} />
    <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: t.muted, fontSize: 13, lineHeight: 20 }}>{label}</Text>
  </View>;
}
export function PlantListSkeleton({ label = 'Loading plants…' }: { label?: string }) {
  const t = gardenThemes.grove;
  return <View style={{ gap: 12 }}>
    <PendingStatus label={label} />
    <LoadingPulse style={{ gap: 10 }}>{[0, 1, 2].map(index => <View key={index} style={{ minHeight: 104, borderRadius: 20, padding: 12, backgroundColor: t.surface, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <View style={{ width: 72, height: 80, borderRadius: 14, backgroundColor: t.elevated }} />
      <View style={{ flex: 1, gap: 10 }}><View style={{ height: 14, width: '62%', backgroundColor: t.elevated, borderRadius: 7 }} /><View style={{ height: 10, width: '42%', backgroundColor: t.elevated, borderRadius: 6 }} /><View style={{ height: 10, width: '72%', backgroundColor: t.elevated, borderRadius: 6 }} /></View>
    </View>)}</LoadingPulse>
  </View>;
}
