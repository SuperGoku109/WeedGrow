import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { gardenLayout, gardenThemes } from '@/design-system/tokens/garden';
export default function Feedback({ message, tone = 'info', onRetry }: { message: string; tone?: 'info' | 'error' | 'loading'; onRetry?: () => void }) {
  const theme = gardenThemes.grove;
  return <View style={{ gap: gardenLayout.controlGap, paddingVertical: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{tone === 'loading' && <ActivityIndicator color={theme.accent} />}<Text accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={{ color: tone === 'error' ? theme.danger : theme.muted, lineHeight: 22, flexShrink: 1 }}>{message}</Text></View>
    {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: gardenLayout.touchTarget, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 }}><Text style={{ color: theme.accent }}>Try again</Text></Pressable>}
  </View>;
}
