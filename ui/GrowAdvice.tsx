import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowCollapse, GrowPress, GrowReveal, GrowRotate } from './GrowMotion';
export interface Suggestion { key: string; icon: string; title: string; description?: string; affected: string[]; onExpand?: () => void }
function AdviceCard({ item }: { item: Suggestion }) {
  const t = useAppTheme();
  const s = makeStyles(t);
  const [open, setOpen] = React.useState(false);
  return <View style={s.card}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${item.title}. ${open ? 'Hide' : 'Show'} details`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={s.row}>
      <View style={s.icon}><Text style={{ fontSize: 20 }}>{item.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.label}>GROW NOTES</Text><Text style={s.title}>{item.title}</Text><Text style={s.names} numberOfLines={1}>{item.affected.join(' · ')}</Text></View>
      <GrowRotate expanded={open}><MaterialCommunityIcons name="chevron-down" size={20} color={t.muted} /></GrowRotate>
    </GrowPress>
    <GrowCollapse open={open}><Text style={s.description}>{item.description}</Text>{item.onExpand && <GrowPress accessibilityRole="button" onPress={item.onExpand}><Text style={s.link}>View affected plants →</Text></GrowPress>}</GrowCollapse>
  </View>;
}
export function SuggestionCatalog({ suggestions }: { suggestions: Suggestion[] }) {
  const s = makeStyles(useAppTheme());
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
const makeStyles = (t: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  catalog: { marginHorizontal: 18, marginBottom: 8, maxHeight: 180, flexGrow: 0, flexShrink: 0 },
  card: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 20, marginBottom: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  icon: { width: 38, height: 42, backgroundColor: t.elevated, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'SpaceMono', fontSize: 8, letterSpacing: 1.5, color: t.accent, marginBottom: 4 },
  title: { color: t.text, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  names: { color: t.muted, fontSize: 10, marginTop: 4 },
  description: { color: t.muted, fontSize: 12, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 14 },
  link: { color: t.accent, paddingHorizontal: 16, paddingBottom: 16, fontSize: 12 },
});
export default SuggestionCatalog;
