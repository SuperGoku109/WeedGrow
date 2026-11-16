import { useEffect } from 'react';
import type { GardenTheme } from '@/design-system/tokens/garden';

/** CSS focus rings, browser chrome and embedded web controls follow app appearance. */
export function useThemeDocument(theme: GardenTheme) {
  useEffect(() => {
    const root = document.documentElement;
    for (const key of ['accent', 'background', 'surface', 'text', 'muted', 'border', 'elevated'] as const) {
      root.style.setProperty(`--garden-${key}`, theme[key]);
    }
    root.style.setProperty('--garden-color-scheme', theme.mode);
    root.style.colorScheme = theme.mode;
    root.style.backgroundColor = theme.background;
    document.body.style.backgroundColor = theme.background;
    document.body.style.colorScheme = theme.mode;
    const appRoot = document.getElementById('root');
    if (appRoot) {
      appRoot.style.backgroundColor = theme.background;
      appRoot.style.colorScheme = theme.mode;
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);
  }, [theme]);
}
