import GardenWeatherProvider from '@/features/home/GardenWeatherProvider';
import { useEffect } from 'react';
import { installErrorReporting } from '@/services/errorReporting';
import AppErrorBoundary from '@/ui/AppErrorBoundary';
import NotificationNavigation from '@/features/care/NotificationNavigation';
import '@/ui/accessibilityStyles';
import ReminderCoordinator from '@/features/care/ReminderCoordinator';
import { Slot } from 'expo-router';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
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
    },
  };

  return (
    <AppErrorBoundary><GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
            <GardenWeatherProvider><NotificationNavigation />
            <ReminderCoordinator />
            <Slot />
            <StatusBar style="light" /></GardenWeatherProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView></AppErrorBoundary>
  );
}
