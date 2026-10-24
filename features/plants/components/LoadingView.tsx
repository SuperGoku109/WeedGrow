import React from 'react';
import LoadingState from '@/ui/LoadingState';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoadingView({ onBack }: { onBack?: () => void }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#15231c' }}><LoadingState label="Loading your plant…" onBack={onBack} /></SafeAreaView>;
}
