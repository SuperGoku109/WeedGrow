// Web implementation of the color scheme hook.
// We want the application to always use the dark theme so
// this hook simply returns "dark" regardless of the system
// preference or hydration state.
export function useColorScheme() {
  return 'dark' as const;
}
