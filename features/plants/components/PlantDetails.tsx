import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import type { Plant } from '@/firestoreModels';
import { plantProfile, type ProfileField } from '../plantProfile';
import type { PlantTheme } from './plantDetailTheme';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function Facts({ fields, theme: t }: { fields: ProfileField[]; theme: PlantTheme }) {
  return <View style={s.facts}>{fields.map(field => <View key={field.label} style={{ width: field.wide ? '100%' : '47%', gap: 5 }}><Text style={[s.label, { color: t.muted }]}>{field.label}</Text><Text selectable style={[s.value, { color: t.text }]}>{field.value}</Text></View>)}</View>;
}
function ProfileCard({ title, icon, theme: t, children, onLayout, highlighted }: { title: string; icon: Icon; theme: PlantTheme; children: React.ReactNode; onLayout?(y: number): void; highlighted?: boolean }) {
  return <View onLayout={event => onLayout?.(event.nativeEvent.layout.y)} style={[s.card, { backgroundColor: t.surface, borderColor: highlighted ? t.accent : t.border }]}>
    <View style={s.header}><View style={[s.icon, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name={icon} size={20} color={t.accent} aria-hidden /></View><Text accessibilityRole="header" style={[s.cardTitle, { color: t.text }]}>{title}</Text></View>
    {children}
  </View>;
}
function LongNote({ field, theme: t }: { field: ProfileField; theme: PlantTheme }) {
  const [expanded, setExpanded] = React.useState(false);
  const collapsible = field.value.length > 100 || field.value.split('\n').length > 4;
  return <View style={{ gap: 6 }}><Text style={[s.label, { color: t.muted }]}>{field.label}</Text><Text selectable numberOfLines={collapsible && !expanded ? 5 : undefined} style={[s.note, { color: t.text }]}>{field.value}</Text>{collapsible && <GrowPress accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Read full'} ${field.label.toLowerCase()}`} aria-expanded={expanded} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.elevated, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: t.accent, fontSize: 14 }}>{expanded ? 'Show less' : 'Read full note'}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={t.accent} /></GrowPress>}</View>;
}
export default function PlantDetails({ plant, theme: t, locationHistory, onSectionLayout, highlightedSection }: { plant: Plant; theme: PlantTheme; locationHistory?: React.ReactNode; onSectionLayout?(key: string, y: number): void; highlightedSection?: string }) {
  const profile = plantProfile(plant);
  const [technical, setTechnical] = React.useState(false);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const location = plant.locationNickname?.trim() || plant.locationLabel?.trim();
  const anchor = (key: string) => ({ onLayout: (y: number) => onSectionLayout?.(key, y), highlighted: highlightedSection === key });
  return <View style={{ gap: 14, paddingTop: 16 }}>
    <ProfileCard {...anchor('Basics')} title="Basics" icon="sprout-outline" theme={t}><Facts fields={profile.basics} theme={t} /></ProfileCard>
    <ProfileCard {...anchor('Growing setup')} title="Growing setup" icon="flower-poppy" theme={t}><Facts fields={profile.setup} theme={t} /></ProfileCard>
    <ProfileCard {...anchor('Care plan')} title="Care routine" icon="watering-can-outline" theme={t}>
      {profile.care.length ? <View style={{ gap: 18 }}>{profile.care.map(field => <View key={field.label} style={{ flexDirection: 'row', gap: 12 }}><MaterialCommunityIcons name={field.label === 'Watering' ? 'water-outline' : field.label === 'Reminders' ? 'bell-outline' : 'flask-outline'} size={20} color={field.label === 'Watering' ? t.water : t.accent} aria-hidden /><View style={{ flex: 1, gap: 5 }}><Text style={[s.label, { color: t.muted }]}>{field.label}</Text><Text selectable style={[s.value, { color: t.text }]}>{field.value}</Text></View></View>)}</View> : <Text style={[s.note, { color: t.muted }]}>No care routine set.</Text>}
    </ProfileCard>
    <ProfileCard {...anchor('Location and weather')} title="Location" icon="map-marker-outline" theme={t}>
      <View style={{ gap: 8 }}><Text selectable style={[s.value, { color: location ? t.text : t.muted }]}>{location || (plant.location ? 'Pinned location' : 'No location set')}</Text>{!!plant.locationNickname && !!plant.locationLabel && plant.locationNickname !== plant.locationLabel && <Text selectable style={[s.note, { color: t.muted }]}>{plant.locationLabel}</Text>}{!plant.location && <Text style={[s.note, { color: t.muted }]}>Local weather and care advice need a location.</Text>}</View>
      {!!profile.technical.length && <><GrowPress accessibilityRole="button" accessibilityLabel="Coordinates and sensor details" aria-expanded={technical} accessibilityState={{ expanded: technical }} onPress={() => setTechnical(value => !value)} style={s.disclosure}><Text style={{ color: t.accent, fontSize: 14, flex: 1 }}>Coordinates & sensor</Text><MaterialCommunityIcons name={technical ? 'chevron-up' : 'chevron-down'} size={20} color={t.muted} /></GrowPress>{technical && <Facts fields={profile.technical} theme={t} />}</>}
      {locationHistory}
    </ProfileCard>
    <ProfileCard {...anchor('Notes and history')} title="Profile notes" icon="notebook-outline" theme={t}>
      {profile.notes.length ? <View style={{ gap: 20 }}>{profile.notes.filter(field => field.label !== 'Training' && field.label !== 'Pests recorded').map(field => <LongNote key={field.label} field={field} theme={t} />)}{[{ label: 'Training', values: plant.trainingTags }, { label: 'Pests recorded', values: plant.pests }].filter(group => group.values?.length).map(group => <View key={group.label} style={{ gap: 8 }}><Text style={[s.label, { color: t.muted }]}>{group.label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{group.values!.map((value, index) => <View key={index} style={{ maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: t.elevated, borderRadius: 10 }}><Text selectable style={{ color: t.text, fontSize: 13, lineHeight: 20 }}>{value}</Text></View>)}</View></View>)}</View> : <Text style={[s.note, { color: t.muted }]}>No profile notes saved. Dated observations are in the Journal.</Text>}
    </ProfileCard>
    <View style={{ paddingHorizontal: 4 }}><GrowPress accessibilityRole="button" accessibilityLabel="Record information" aria-expanded={recordOpen} accessibilityState={{ expanded: recordOpen }} onPress={() => setRecordOpen(value => !value)} style={[s.disclosure, { marginTop: 0 }]}><MaterialCommunityIcons name="information-outline" size={19} color={t.muted} /><Text style={{ color: t.muted, fontSize: 14, flex: 1 }}>Record information</Text><MaterialCommunityIcons name={recordOpen ? 'chevron-up' : 'chevron-down'} size={20} color={t.muted} /></GrowPress>{recordOpen && (profile.record.length ? <View style={{ paddingVertical: 12 }}><Facts fields={profile.record} theme={t} /></View> : <Text style={[s.note, { color: t.muted }]}>Record dates are unavailable.</Text>)}</View>
  </View>;
}
const s = StyleSheet.create({
  title: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  card: { borderBottomWidth: 1, borderRadius: 12, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', flex: 1, lineHeight: 24 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 20 },
  label: { fontSize: 13, lineHeight: 19 },
  value: { fontSize: 16, fontWeight: '500', lineHeight: 23 },
  note: { fontSize: 14, lineHeight: 22 },
  disclosure: { minHeight: 48, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
