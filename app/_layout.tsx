import { useAppTheme } from '@/hooks/useAppTheme';
import GardenWeatherProvider from '@/features/home/GardenWeatherProvider';
import WateringRoutineCoordinator from '@/features/plants/WateringRoutineCoordinator';
import { useEffect } from 'react';
import { installErrorReporting } from '@/services/errorReporting';
import AppErrorBoundary from '@/ui/AppErrorBoundary';
import NotificationNavigation from '@/features/care/NotificationNavigation';
import '@/ui/accessibilityStyles';
import ReminderCoordinator from '@/features/care/ReminderCoordinator';
import { Stack } from 'expo-router';
import { useReducedMotion } from '@/ui/GrowMotion';
import RouteTransition from '@/ui/RouteTransition';
import Head from 'expo-router/head';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme as NavigationDarkTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';

export default function RootLayout() {
  const t = useAppTheme();
  const light = t.background === '#f2f1e5';
  const baseTheme = light ? MD3LightTheme : MD3DarkTheme;
  const navigationTheme = { ...NavigationDarkTheme, dark: !light, colors: { ...NavigationDarkTheme.colors, background: t.background, card: t.surface, text: t.text, border: t.border, primary: t.accent } };
  const reduced = useReducedMotion();
  useEffect(installErrorReporting, []);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  const theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: t.accent,
      background: t.background, surface: t.surface, onSurface: t.text, onSurfaceVariant: t.muted,
      inverseSurface: t.elevated, inverseOnSurface: t.text, inversePrimary: t.accent,
    },
  };

  return (
    <AppErrorBoundary><GestureHandlerRootView style={{ flex: 1, backgroundColor: t.background }}>
      <Head><title>BudBuddy</title></Head>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
            <GardenWeatherProvider><NotificationNavigation />
            <ReminderCoordinator />
            <WateringRoutineCoordinator />
            <NavigationThemeProvider value={navigationTheme}><RouteTransition><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: reduced ? 'none' : 'fade_from_bottom', animationDuration: 260, gestureEnabled: false }}>
              <Stack.Screen name="add-plant" options={{ animation: reduced ? 'none' : 'slide_from_bottom' }} />
            </Stack></RouteTransition></NavigationThemeProvider>
            <StatusBar style={light ? "dark" : "light"} /></GardenWeatherProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView></AppErrorBoundary>
  );
}
