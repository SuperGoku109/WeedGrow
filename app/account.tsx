import React from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccountPanel from '@/features/account/AccountPanel';
import { Press, palette, s } from '@/features/addPlant/components/FlowUI';
export default function AccountScreen() {
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 24, maxWidth: 560, width: '100%', alignSelf: 'center' }}><Press label="Back to garden" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Back to garden</Text></Press><AccountPanel /></ScrollView></SafeAreaView>;
}
