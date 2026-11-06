import React from 'react';
import { Text, View } from 'react-native';
import { GrowPress } from '@/ui/GrowMotion';
import type { DiagnosticEntry } from '@/lib/careAlgorithm/careDiagnostics';
import type { PlantTheme } from './plantDetailTheme';

export default function CareDiagnosticDetails({ entries, theme }: { entries: DiagnosticEntry[]; theme: PlantTheme }) {
  const [open, setOpen] = React.useState(false);
  if (!entries.length) return null;
  return <View style={{ marginTop: 12 }}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${open ? 'Hide' : 'Show'} watering diagnostics`} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: theme.water, fontSize: 13, fontWeight: '600' }}>{open ? 'Hide diagnostic details' : 'Show diagnostic details'}</Text>
    </GrowPress>
    {open && <View style={{ backgroundColor: theme.elevated, borderRadius: 10, padding: 12, gap: 10 }}>
      <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>These details identify the failing care check. You can select and copy them when reporting an issue.</Text>
      {entries.map((entry, index) => <View key={`${entry.label}:${index}`} style={{ gap: 3 }}>
        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{entry.label}</Text>
        <Text selectable style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>{entry.value}</Text>
      </View>)}
    </View>}
  </View>;
}
