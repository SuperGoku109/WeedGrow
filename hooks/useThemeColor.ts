import type { Colors } from '@/constants/Colors';
import { useAppTheme } from './useAppTheme';

export function useThemeColor(props: { light?: string; dark?: string }, colorName: keyof typeof Colors.light & keyof typeof Colors.dark) {
  const t = useAppTheme();
  const override = props[t.mode === 'light' ? 'light' : 'dark'];
  const colors = { text: t.text, background: t.background, tint: t.accent, icon: t.accent, tabIconDefault: t.muted, tabIconSelected: t.accent, gray: t.muted, label: t.muted, white: t.text };
  return override || colors[colorName];
}
