import React from 'react';
import { Pressable, Text, View } from 'react-native';
export default function LoadError({ message, onRetry, onBack }: { message: string; onRetry(): void; onBack(): void }) {
  return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 18, backgroundColor: '#15231c' }}><Text accessibilityRole="alert" style={{ color: '#edf0e3', fontSize: 18 }}>{message}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#d2e4a2' }}>Retry loading plant</Text></Pressable><Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#d2e4a2' }}>Back to garden</Text></Pressable></View>;
}
