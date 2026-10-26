import { gardenCollectionInk as ink } from '@/design-system/tokens/garden';
import React from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useReducedMotion } from '@/ui/GrowMotion';

export { gardenCollectionInk as ink } from '@/design-system/tokens/garden';
export const environments = {
  indoor: { label: 'Indoor', color: '#c4c6ed', icon: 'home-outline' as const, backdrop: '#343748' },
  outdoor: { label: 'Outdoor', color: '#dce9a6', icon: 'white-balance-sunny' as const, backdrop: '#39462c' },
  greenhouse: { label: 'Greenhouse', color: '#abd9c5', icon: 'greenhouse' as const, backdrop: '#2c453b' },
};

export function CollectionReveal({ children, style, delay = 0 }: ViewProps & { delay?: number }) {
  const reduced = useReducedMotion();
  const value = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (reduced) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: 220, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [reduced, value, delay]);
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>{children}</Animated.View>;
}

export function CollectionButton({ label, icon, onPress, primary = false, disabled = false }: {
  label: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, primary && styles.primary, { opacity: disabled ? 0.5 : pressed ? 0.78 : 1 }]}>
    {icon && <MaterialCommunityIcons name={icon} size={18} color={primary ? ink.dark : ink.text} />}
    <Text style={[styles.buttonText, primary && { color: ink.dark }]}>{label}</Text>
  </Pressable>;
}

/** Lightweight architectural illustration; no raster downloads or looping effects. */
export function SpaceArtwork({ environment }: { environment: string }) {
  const color = environments[environment as keyof typeof environments]?.color || ink.lime;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={100} height={88} viewBox="0 0 100 88">
      <Circle cx={60} cy={41} r={35} fill={color} opacity={0.08} />
      {environment === 'indoor' ? <>
        <Rect x={30} y={13} width={48} height={53} rx={22} stroke={color} strokeWidth={1.4} fill="none" />
        <Path d="M54 14V65M31 39H77" stroke={color} strokeWidth={1} opacity={0.45} />
      </> : environment === 'greenhouse' ? <>
        <Path d="M18 69V36L53 12L87 36V69ZM18 36H87M53 12V69M36 24V69M70 24V69" stroke={color} strokeWidth={1.3} fill="none" opacity={0.7} />
      </> : <>
        <Circle cx={68} cy={24} r={12} stroke={color} strokeWidth={1.4} fill="none" />
        <Path d="M9 68Q36 43 61 64Q80 48 96 61M10 76Q51 60 94 72" stroke={color} strokeWidth={1.2} fill="none" opacity={0.55} />
      </>}
      <Path d="M43 69V43M43 57C24 59 24 43 25 40C37 39 44 48 43 57ZM43 49C42 35 53 31 62 33C61 44 54 50 43 49" fill={color} opacity={0.9} />
      <Path d="M34 67H52L49 79H37Z" fill={color} opacity={0.55} />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: ink.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primary: { backgroundColor: ink.lime, borderColor: ink.lime },
  buttonText: { color: ink.text, fontSize: 14, fontWeight: '700' },
});
