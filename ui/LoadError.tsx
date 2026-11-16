import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Feedback from './Feedback';
import { gardenLayout } from '@/design-system/tokens/garden';
export default function LoadError({ message, onRetry, onBack }: { message: string; onRetry(): void; onBack(): void }) {
  const t = useAppTheme();
  return <View style={{ flex: 1, justifyContent: 'center', padding: gardenLayout.screenPadding, gap: 18, backgroundColor: t.background }}><Feedback message={message} tone="error" onRetry={onRetry} /><Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: gardenLayout.touchTarget, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Back to garden</Text></Pressable></View>;
}
