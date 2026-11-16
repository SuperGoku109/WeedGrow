import { useAppTheme } from './useAppTheme';

export function useColorScheme() {
  return useAppTheme().mode === 'light' ? 'light' as const : 'dark' as const;
}
