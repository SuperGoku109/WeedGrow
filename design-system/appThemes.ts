import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { colorAlpha, type GardenTheme } from './tokens/garden';

/** Library components, navigation and native chrome share the same mode and tokens. */
export function appThemes(t: GardenTheme) {
  const light = t.mode === 'light';
  const paperBase = light ? MD3LightTheme : MD3DarkTheme;
  const navigationBase = light ? DefaultTheme : DarkTheme;
  const paper = { ...paperBase, colors: {
    ...paperBase.colors,
    primary: t.accent, onPrimary: t.onAccent, primaryContainer: t.hero, onPrimaryContainer: t.heroText,
    secondary: t.water, onSecondary: t.onWater, secondaryContainer: t.elevated, onSecondaryContainer: t.text,
    tertiary: t.warm, onTertiary: t.onDanger, tertiaryContainer: t.elevated, onTertiaryContainer: t.text,
    background: t.background, onBackground: t.text,
    surface: t.surface, onSurface: t.text, surfaceVariant: t.elevated, onSurfaceVariant: t.muted,
    surfaceDisabled: colorAlpha(t.text, .12), onSurfaceDisabled: colorAlpha(t.text, .38),
    outline: t.border, outlineVariant: t.border,
    error: t.danger, onError: t.onDanger, errorContainer: t.surface, onErrorContainer: t.danger,
    inverseSurface: t.elevated, inverseOnSurface: t.text, inversePrimary: t.accent,
    backdrop: colorAlpha(t.scrim, .65), shadow: t.shadow,
    elevation: { level0: 'transparent', level1: t.surface, level2: t.elevated, level3: t.elevated, level4: t.elevated, level5: t.elevated },
  } };
  const navigation = { ...navigationBase, colors: { ...navigationBase.colors,
    background: t.background, card: t.surface, text: t.text, border: t.border, primary: t.accent, notification: t.danger,
  } };
  return { light, paper, navigation };
}
