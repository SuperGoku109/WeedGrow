import { useThemeDocument } from '@/ui/useThemeDocument';
import { appThemes } from '@/design-system/appThemes';
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
import PlantImageTransitionProvider, { usePlantImageTransition } from '@/ui/PlantImageTransition';
import RouteTransition from '@/ui/RouteTransition';
import Head from 'expo-router/head';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function RootLayout() {
  const t = useAppTheme();
  useThemeDocument(t);
  const { light, paper: theme, navigation: navigationTheme } = appThemes(t);
  const reduced = useReducedMotion();
  useEffect(installErrorReporting, []);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AppErrorBoundary theme={t}><GestureHandlerRootView style={{ flex: 1, backgroundColor: t.background }}>
      <Head><title>BudBuddy</title></Head>
      <KeyboardProvider><SafeAreaProvider>
        <PaperProvider theme={theme}>
            <GardenWeatherProvider><NotificationNavigation />
            <ReminderCoordinator />
            <WateringRoutineCoordinator />
            <NavigationThemeProvider value={navigationTheme}><PlantImageTransitionProvider><RouteTransition><PlantNavigation>
              <Stack.Screen name="add-plant" options={{ animation: reduced ? 'none' : 'slide_from_bottom' }} />
            </PlantNavigation></RouteTransition></PlantImageTransitionProvider></NavigationThemeProvider>
            <StatusBar style={light ? "dark" : "light"} /></GardenWeatherProvider>
        </PaperProvider>
      </SafeAreaProvider></KeyboardProvider>
    </GestureHandlerRootView></AppErrorBoundary>
  );
}

function PlantNavigation({ children }: { children: React.ReactNode }) {
  const t = useAppTheme();
  const reduced = useReducedMotion();
  const shared = usePlantImageTransition();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: reduced || shared.active ? 'none' : 'fade_from_bottom', animationDuration: 260, gestureEnabled: false }}>{children}</Stack>;
}
