// Force a dark color scheme throughout the app
// Instead of relying on the system preferences we simply
// return "dark" so every screen is rendered with the dark theme.
export function useColorScheme() {
  return 'dark' as const;
}
