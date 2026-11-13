import { useAppTheme } from '@/hooks/useAppTheme';
import { gardenControls } from '@/design-system/tokens/garden';
import React from 'react';
import { GrowPress } from './GrowMotion';
import { type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/** Shared dismissal control: visible icon, phone-sized target, spoken context. */
export default function CloseButton({ label, onPress, disabled = false, color, style }: {
  label: string; onPress(): void; disabled?: boolean; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const t = useAppTheme();
  return <GrowPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed }) => [{ width: gardenControls.height, height: gardenControls.height, flexShrink: 0, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff0a', opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }, style]}>
    <MaterialCommunityIcons name="close" size={20} color={color || t.text} accessible={false} />
  </GrowPress>;
}
