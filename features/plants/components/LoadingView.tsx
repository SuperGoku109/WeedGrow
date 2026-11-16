import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import LoadingState from '@/ui/LoadingState';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoadingView({ onBack }: { onBack?: () => void }) {
  const t = useAppTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}><LoadingState label="Loading your plant…" onBack={onBack} /></SafeAreaView>;
}
