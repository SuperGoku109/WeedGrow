import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import { EditorTheme } from './PlantEditorFields';

export default function EditorGroup({ title, hint, collapsible = false, flat = false, children }: { title: string; hint?: string; collapsible?: boolean; flat?: boolean; children: React.ReactNode }) {
  const t = React.useContext(EditorTheme);
  const [open, setOpen] = React.useState(!collapsible);
  if (flat) return <View style={{ gap: 10 }}>{children}</View>;
  return <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: t.border, paddingTop: collapsible ? 0 : 12 }}>
    {collapsible ? <GrowPress accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>{!!hint && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{hint}</Text>}</View><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={t.muted} /></GrowPress> : <View style={{ gap: 4 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>{!!hint && <Text style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}>{hint}</Text>}</View>}
    {open && children}
  </View>;
}
