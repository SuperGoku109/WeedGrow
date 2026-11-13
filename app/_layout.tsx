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
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme as NavigationDarkTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';

const navigationTheme = {
  ...NavigationDarkTheme,
  colors: { ...NavigationDarkTheme.colors, background: '#15231c', card: '#23342a', text: '#edf0e3', border: '#40523a', primary: '#c8e78b' },
};

export default function RootLayout() {
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
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: Colors.dark.tint,
      background: '#15231c', surface: '#23342a', onSurface: '#edf0e3', onSurfaceVariant: '#bac8b3',
      inverseSurface: '#263d30', inverseOnSurface: '#edf0e3', inversePrimary: '#c8e78b',
    },
  };

  return (
    <AppErrorBoundary><GestureHandlerRootView style={{ flex: 1, backgroundColor: '#15231c' }}>
      <Head><title>BudBuddy</title></Head>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
            <GardenWeatherProvider><NotificationNavigation />
            <ReminderCoordinator />
            <WateringRoutineCoordinator />
            <NavigationThemeProvider value={navigationTheme}><RouteTransition><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#15231c' }, animation: reduced ? 'none' : 'fade_from_bottom', animationDuration: 260, gestureEnabled: false }}>
              <Stack.Screen name="add-plant" options={{ animation: reduced ? 'none' : 'slide_from_bottom' }} />
            </Stack></RouteTransition></NavigationThemeProvider>
            <StatusBar style="light" /></GardenWeatherProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView></AppErrorBoundary>
  );
}
