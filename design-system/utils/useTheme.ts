import { useMemo } from 'react';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorAlpha, type GardenTheme } from '../tokens/garden';
import { ColorTokens, Spacing, Typography, BorderRadius, Shadows } from '../tokens';

/** Preserve the legacy component API while using the app's selected palette. */
export function legacyThemeColors(t: GardenTheme) {
  return {
    ...ColorTokens,
    brand: { ...ColorTokens.brand, primary: t.accent, primaryDark: t.accent, primaryLight: t.accent, secondary: t.water, accent: t.accent },
    text: { primary: t.text, secondary: t.muted, tertiary: t.muted, accent: t.accent, inverse: t.onAccent },
    background: { primary: t.background, secondary: t.surface, tertiary: t.elevated, card: t.surface, surface: t.elevated, overlay: colorAlpha(t.scrim, .65) },
    border: { primary: t.border, secondary: t.border, accent: t.accent, error: t.danger },
    status: { success: t.accent, warning: t.warm, error: t.danger, info: t.water },
    shadow: t.shadow,
    onPrimary: t.onAccent, onSecondary: t.onWater, onError: t.onDanger,
    theme: { background: t.background, surface: t.surface, text: t.text, textSecondary: t.muted, border: t.border, primary: t.accent },
  };
}
export interface Theme {
  colors: ReturnType<typeof legacyThemeColors>;
  spacing: typeof Spacing;
  typography: typeof Typography;
  radius: typeof BorderRadius;
  shadows: typeof Shadows;
  isDark: boolean;
}
export function useTheme(): Theme {
  const t = useAppTheme();
  const colors = useMemo(() => legacyThemeColors(t), [t]);
  return { colors, spacing: Spacing, typography: Typography, radius: BorderRadius, shadows: Shadows, isDark: t.mode === 'dark' };
}
