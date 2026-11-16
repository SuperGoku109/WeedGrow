import { useAppTheme } from '@/hooks/useAppTheme';
import { Stack } from 'expo-router';
import React from 'react';
import { useReducedMotion } from '@/ui/GrowMotion';

export default function PlantLayout() {
  const t = useAppTheme();
  const reduced = useReducedMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: reduced ? 'none' : 'fade_from_bottom', animationDuration: 260 }} />;
}
