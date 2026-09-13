import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress, GrowReveal } from './GrowMotion';
export interface Suggestion { key: string; icon: string; title: string; description?: string; affected: string[]; onExpand?: () => void }
function AdviceCard({ item }: { item: Suggestion }) {
  const [open, setOpen] = React.useState(false);
  return <View style={s.card}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${item.title}. ${open ? 'Hide' : 'Show'} details`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={s.row}>
      <View style={s.icon}><Text style={{ fontSize: 20 }}>{item.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.label}>GROW NOTES</Text><Text style={s.title}>{item.title}</Text><Text style={s.names} numberOfLines={1}>{item.affected.join(' · ')}</Text></View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#b9c7ab" />
    </GrowPress>
    {open && <GrowReveal><Text style={s.description}>{item.description}</Text>{item.onExpand && <GrowPress accessibilityRole="button" onPress={item.onExpand}><Text style={s.link}>View affected plants →</Text></GrowPress>}</GrowReveal>}
  </View>;
}
export function SuggestionCatalog({ suggestions }: { suggestions: Suggestion[] }) {
  if (!suggestions.length) return null;
  return (
    <ScrollView
      style={s.catalog}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <GrowReveal delay={100}>
        {suggestions.map(item => <AdviceCard key={item.key} item={item} />)}
      </GrowReveal>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  catalog: { marginHorizontal: 18, marginBottom: 8, maxHeight: 180, flexGrow: 0, flexShrink: 0 },
  card: { backgroundColor: '#23342e', borderWidth: 1, borderColor: '#384b3e', borderRadius: 20, marginBottom: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  icon: { width: 38, height: 42, backgroundColor: '#324a43', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'SpaceMono', fontSize: 8, letterSpacing: 1.5, color: '#b7cd9b', marginBottom: 4 },
  title: { color: '#edf0e3', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  names: { color: '#a3b6aa', fontSize: 10, marginTop: 4 },
  description: { color: '#c2cfc3', fontSize: 12, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 14 },
  link: { color: '#c8e78b', paddingHorizontal: 16, paddingBottom: 16, fontSize: 12 },
});
export default SuggestionCatalog;
