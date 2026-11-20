import { usePlantImageTransition } from '@/ui/PlantImageTransition';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from '@/ui/GrowMotion';

export default function PlantLayout() {
  const t = useAppTheme();
  const shared = usePlantImageTransition();
  const reduced = useReducedMotion();
  const photoEntry = Platform.OS === 'android' && shared.active;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: photoEntry ? 'transparent' : t.background }, animation: reduced || shared.active ? 'none' : 'fade_from_bottom', animationDuration: 260 }} />;
}
