import type { PlantTheme } from './plantDetailTheme';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMovementHistory } from '@/hooks/useMovementHistory';
export default function PlantMovementHistory({ plantId, theme }: { plantId: string; theme: PlantTheme }) {
  const { data: entries, loading, error, refresh } = useMovementHistory(plantId);
  return <View style={{ gap: 8 }}><Text style={{ color: theme.text, fontWeight: '600' }}>Recent location changes</Text><Text style={{ color: theme.muted, fontSize: 13, lineHeight: 21 }}>Moves recorded from now on also appear in the full garden journal. Earlier weather stays unchanged.</Text>{!!error && <Pressable accessibilityRole="button" onPress={refresh} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.danger }}>{error} Tap to retry.</Text></Pressable>}{!error && !entries.length && <Text style={{ color: theme.muted }}>{loading ? 'Loading movement history…' : 'No moves in the latest 100 journal entries. Older moves remain in the full journal.'}</Text>}{entries.map((entry, index) => <Text key={index} style={{ color: theme.muted }}>{entry.timestamp?.toDate?.().toLocaleString()} · {entry.description}</Text>)}</View>;
}
