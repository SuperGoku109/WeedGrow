import type { PlantTheme } from './plantDetailTheme';
import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import { useMovementHistory } from '@/hooks/useMovementHistory';
export default function PlantMovementHistory({ plantId, theme: t, active = true }: { plantId: string; theme: PlantTheme; active?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const { data: entries, loading, error, refresh } = useMovementHistory(plantId, expanded && active);
  return <View style={{ marginTop: 8 }}>
    <GrowPress accessibilityRole="button" accessibilityLabel="Location history" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: t.accent, fontSize: 14, flex: 1 }}>Location history</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={t.muted} /></GrowPress>
    {expanded && <View style={{ gap: 12, paddingTop: 6 }}><Text style={{ color: t.muted, fontSize: 13, lineHeight: 21 }}>Moving this plant keeps earlier weather unchanged.</Text>{!!error && <GrowPress accessibilityRole="button" onPress={refresh} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.danger }}>{error} Tap to retry.</Text></GrowPress>}{!error && !entries.length && <Text style={{ color: t.muted, fontSize: 14, lineHeight: 22 }}>{loading ? 'Loading location history…' : 'No moves recorded in the latest 100 journal entries.'}</Text>}{entries.map((entry, index) => <View key={index} style={{ gap: 5, borderLeftWidth: 2, borderColor: t.border, paddingLeft: 12 }}><Text style={{ color: t.muted, fontSize: 12 }}>{entry.timestamp?.toDate?.().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text><Text style={{ color: t.text, fontSize: 14, lineHeight: 22 }}>{entry.description}</Text></View>)}<Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>Older moves remain in the full garden journal.</Text></View>}
  </View>;
}
