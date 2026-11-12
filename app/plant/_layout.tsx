import { Stack } from 'expo-router';
import React from 'react';
import { useReducedMotion } from '@/ui/GrowMotion';

export default function PlantLayout() {
  const reduced = useReducedMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#15231c' }, animation: reduced ? 'none' : 'fade_from_bottom', animationDuration: 260 }} />;
}
