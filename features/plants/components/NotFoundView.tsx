import React from 'react';
import { Container, Text } from '@/design-system/components';
import { useAppTheme } from '@/hooks/useAppTheme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundView() {
  const t = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <Container 
        style={{ flex: 1 }} 
        align="center" 
        justify="center"
      >
        <Text variant="body" style={{ color: t.text }}>Plant not found.</Text>
      </Container>
    </SafeAreaView>
  );
}
