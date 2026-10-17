import { PlantImage as Image } from '@/ui/PlantImage';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress, GrowReveal } from '@/ui/GrowMotion';
import type { Plant, WeatherCacheEntry } from '@/firestoreModels';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import type { PlantTheme } from './plantDetailTheme';

export const detailStyles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  eyebrow: { fontSize: 12, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
export function SectionTitle({ title, caption, theme }: { title: string; caption?: string; theme: PlantTheme }) {
  return <View style={[detailStyles.section, { flexWrap: 'wrap' }]}><Text style={[detailStyles.title, { color: theme.text }]}>{title}</Text>{caption && <Text style={{ color: theme.muted, fontSize: 12 }}>{caption}</Text>}</View>;
}
export function EmptyCard({ title, text, theme }: { title: string; text: string; theme: PlantTheme }) {
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.text, fontWeight: '600', marginBottom: 5 }}>{title}</Text><Text style={[detailStyles.body, { color: theme.muted }]}>{text}</Text></View>;
}
export function PlantIdentity({ plant, theme }: { plant: Plant; theme: PlantTheme }) {
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [uri]);
  return <View style={[detailStyles.row, { paddingVertical: 16, alignItems: 'flex-start' }]}>
    {uri && !broken ? <Image source={{ uri }} onError={() => setBroken(true)} style={{ width: 60, height: 72, borderRadius: 16, backgroundColor: theme.surface }} /> : <View style={{ width: 60, height: 72, borderRadius: 16, backgroundColor: theme.hero, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="sprout" size={34} color={theme.heroText} /></View>}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>{plant.name}</Text>
      <Text style={{ color: theme.muted, fontSize: 14, marginTop: 3 }}>{plant.strain || 'Strain not set'}</Text>
      <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600', marginTop: 8, textTransform: 'capitalize' }}>{plant.growthStage || 'Growing'} · {plant.status || 'active'}</Text>
      <Text style={{ color: theme.muted, fontSize: 13, marginTop: 5, textTransform: 'capitalize' }}>{plant.environment} · {plant.locationNickname || (plant.plantedIn === 'pot' ? 'Potted plant' : 'In the ground')}</Text>
    </View>
  </View>;
}
function metric(value?: number | null, unit = '') { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}${unit}` : '—'; }
export function WeatherPanel({ weather, theme, label, loading, error, compact = false }: { compact?: boolean; weather?: WeatherCacheEntry; theme: PlantTheme; label: string; loading?: boolean; error?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!weather) return <EmptyCard theme={theme} title={loading ? 'Loading the forecast…' : 'No weather recorded'} text={error || 'Weather appears here when a forecast is available for this location and date.'} />;
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    {compact ? <><Text style={{ color: theme.muted, fontSize: 13 }}>{label} · {weather.forecasted ? 'Forecast' : 'Recorded'}</Text><Text style={{ color: theme.text, fontSize: 15, lineHeight: 24, fontWeight: '600', marginTop: 8 }}>{metric(weather.temperature ?? weather.detailedTemps?.day, '°C')} · {metric(weather.humidity, '%')} humidity · {metric(weather.rainfall, ' mm')} rain</Text></> : <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}><Text style={[detailStyles.eyebrow, { color: theme.muted }]}>{label.toUpperCase()}</Text><Text style={{ color: theme.text, fontSize: 34, fontWeight: '600', letterSpacing: -1, marginTop: 6 }}>{metric(weather.temperature ?? weather.detailedTemps?.day, '°')}<Text style={{ fontSize: 15 }}>C</Text></Text><Text style={{ color: theme.muted, fontSize: 12, textTransform: 'capitalize' }}>{weather.weatherSummary || 'Conditions recorded'}</Text></View>
      <MaterialCommunityIcons name={weather.weatherSummary?.toLowerCase().includes('rain') ? 'weather-rainy' : weather.weatherSummary?.toLowerCase().includes('cloud') ? 'weather-cloudy' : 'weather-sunny'} size={48} color={theme.warm} />
    </View>
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: theme.border, marginTop: 15, paddingTop: 14 }}>
      {[['Humidity', metric(weather.humidity, '%')], ['Rain', metric(weather.rainfall, ' mm')], ['High / low', `${metric(weather.detailedTemps?.max, '°')} / ${metric(weather.detailedTemps?.min, '°')}`]].map(([title, value]) => <View key={title} style={{ flex: 1 }}><Text style={{ color: theme.muted, fontSize: 12, marginBottom: 5 }}>{title}</Text><Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{value}</Text></View>)}
    </View>
    </>}
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, alignItems: 'center', paddingTop: 10, paddingBottom: 5, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.water, fontSize: 13 }}>{expanded ? 'Hide weather details' : 'View weather details'}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.muted} /></GrowPress>
    {expanded && <GrowReveal>{compact && <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>{weather.weatherSummary || 'Conditions recorded'} · High {metric(weather.detailedTemps?.max, '°')} / Low {metric(weather.detailedTemps?.min, '°')}</Text>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingTop: 10 }}>
      {[['Wind', metric(weather.windSpeed, ' m/s')], ['Gusts', metric(weather.windGust, ' m/s')], ['UV index', metric(weather.uvIndex)], ['Dew point', metric(weather.dewPoint, '°')], ['Cloud cover', metric(weather.cloudCoverage, '%')], ['Rain chance', metric(typeof weather.pop === 'number' ? weather.pop <= 1 ? weather.pop * 100 : weather.pop : null, '%')], ['Night humidity', metric(weather.nightHumidity, '%')], ['Morning', metric(weather.detailedTemps?.morn, '°')], ['Evening', metric(weather.detailedTemps?.eve, '°')], ['Night', metric(weather.detailedTemps?.night, '°')]].map(([key, value]) => <View key={key} style={{ width: '43%' }}><Text style={{ color: theme.muted, fontSize: 12 }}>{key}</Text><Text style={{ color: theme.text, fontSize: 13, marginTop: 3 }}>{value}</Text></View>)}
    </View>{weather.source && <Text style={{ color: theme.muted, fontSize: 12, marginTop: 14 }}>Source: {weather.source}</Text>}</GrowReveal>}
  </View>;
}
export function InsightPanel({ card, theme, onLog }: { card: SuggestionCard; theme: PlantTheme; onLog?: () => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const color = card.severity === 'critical' ? theme.danger : ['warn', 'watch'].includes(card.severity) ? theme.warm : theme.accent;
  const severity = { critical: 'Urgent', warn: 'Needs attention', watch: 'Watch', info: 'Care note' }[card.severity];
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: color, borderLeftWidth: 3, marginBottom: 10 }]}>
    <GrowPress accessibilityRole="button" accessibilityLabel={card.title + '. ' + (expanded ? 'Hide' : 'Show') + ' explanation'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <MaterialCommunityIcons name={card.kind === 'watering' ? 'water-outline' : card.kind === 'rootRot' ? 'sprout-outline' : 'leaf'} size={24} color={card.kind === 'watering' ? theme.water : color} />
      <View style={{ flex: 1 }}><Text style={{ color, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{severity}</Text><Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', lineHeight: 22 }}>{card.title}</Text><Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{expanded ? 'Hide explanation' : 'Review advice'}</Text></View>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.muted} />
    </GrowPress>
    {expanded && <GrowReveal><Text style={[detailStyles.body, { color: theme.muted, marginTop: 12 }]}>{card.summary}</Text>{Array.from(new Set(card.reasons)).filter(reason => reason !== card.summary).map(reason => <Text key={reason} style={[detailStyles.body, { color: theme.muted, marginTop: 6 }]}>• {reason}</Text>)}<Text style={{ color: theme.muted, fontSize: 12, marginTop: 12, textTransform: 'capitalize' }}>{card.confidence} confidence · Weather-based suggestion</Text></GrowReveal>}
    {onLog && (card.kind === 'watering' || expanded) && <GrowPress accessibilityRole="button" onPress={onLog} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 36 }}><MaterialCommunityIcons name={card.kind === 'watering' ? 'water-outline' : 'notebook-outline'} size={18} color={card.kind === 'watering' ? theme.water : theme.accent} /><Text style={{ color: theme.accent, fontSize: 14, fontWeight: '600' }}>{card.kind === 'watering' ? 'Log watering' : 'Log observation'}</Text></GrowPress>}
  </View>;
}

type DetailField = [string, string | number | null | undefined];
function hasValue(value: DetailField[1]) { return value !== undefined && value !== null && String(value).trim() !== ''; }
function DetailGroup({ title, fields, theme, initialOpen = false }: { title: string; fields: DetailField[]; theme: PlantTheme; initialOpen?: boolean }) {
  const [expanded, setExpanded] = React.useState(initialOpen);
  const [showMissing, setShowMissing] = React.useState(false);
  const populated = fields.filter(([, value]) => hasValue(value));
  const missing = fields.filter(([, value]) => !hasValue(value));
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}>
    <GrowPress accessibilityRole="button" accessibilityLabel={title + ' details'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>{!expanded && <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }}>{populated.length ? populated.slice(0, 3).map(([key, value]) => key + ': ' + value).join(' · ') : 'No details added'}</Text>}</View><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.muted} /></GrowPress>
    {expanded && <View style={{ marginTop: 8 }}>{populated.map(([key, value]) => <View key={key} style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: theme.border, flexDirection: 'row', gap: 16 }}><Text style={{ color: theme.muted, fontSize: 14, width: '40%' }}>{key}</Text><Text selectable style={{ color: theme.text, fontSize: 14, flex: 1 }}>{value}</Text></View>)}
      {!!missing.length && <><GrowPress accessibilityRole="button" accessibilityState={{ expanded: showMissing }} onPress={() => setShowMissing(!showMissing)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.accent, fontSize: 14 }}>{showMissing ? 'Hide' : 'Show'} {missing.length} optional {missing.length === 1 ? 'field' : 'fields'}</Text></GrowPress>{showMissing && <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 22 }}>{missing.map(([key]) => key).join(' · ')}. Use Edit to add these details.</Text>}</>}
    </View>}
  </View>;
}
export function PlantDetails({ plant, theme, onEdit }: { plant: Plant; theme: PlantTheme; onEdit: () => void }) {
  const fields = [ ['Growth stage', plant.growthStage], ['Status', plant.status], ['Added', plant.createdAt?.toDate?.().toLocaleDateString('en-GB')], ['Last updated', plant.updatedAt?.toDate?.().toLocaleDateString('en-GB')], ['Strain', plant.strain], ['Age', plant.ageKnown === false ? 'Unknown' : plant.ageDays != null ? `${plant.ageDays} days` : undefined], ['Height', plant.height != null ? `${plant.height} cm` : undefined], ['Environment', plant.environment], ['Planted in', plant.plantedIn], ['Pot size', plant.potSize], ['Sunlight', plant.sunlightExposure], ['Soil type', ({ native: 'Native soil', raised: 'Raised bed soil', store: 'Potting soil', custom: 'Custom mix' } as Record<string, string>)[plant.soilType || ''] || plant.soilType], ['Soil pH', plant.soilPh], ['Protection', plant.permanentProtection?.replace(/_/g, ' ')], ['Companion plants', plant.companionPlants?.join(', ')], ['Setup notes', plant.environmentNotes], ['Watering schedule', plant.wateringFrequency], ['Fertilizer', plant.fertilizer], ['Location', plant.locationNickname], ['Coordinates', plant.location ? `${plant.location.lat.toFixed(4)}, ${plant.location.lng.toFixed(4)}` : undefined], ['Sensor profile', plant.sensorProfileId], ['Reminder', plant.reminderSchedule ? `${plant.reminderSchedule.type}${plant.reminderSchedule.intervalDays ? ` · every ${plant.reminderSchedule.intervalDays} days` : ''}${plant.reminderSchedule.customDays?.length ? ` · ${plant.reminderSchedule.customDays.join(', ')}` : ''}${plant.reminderSchedule.timeOfDay ? ` · ${plant.reminderSchedule.timeOfDay}` : ''}` : undefined] ];
  const groups = [
    { title: 'Basics', keys: ['Growth stage', 'Status', 'Strain', 'Age', 'Height'] },
    { title: 'Growing setup', keys: ['Environment', 'Planted in', 'Pot size', 'Sunlight', 'Soil type', 'Soil pH', 'Protection', 'Companion plants'] },
    { title: 'Care plan', keys: ['Watering schedule', 'Fertilizer', 'Reminder'] },
    { title: 'Location and weather', keys: ['Location', 'Coordinates', 'Sensor profile'] },
    { title: 'Notes and history', keys: ['Notes', 'Setup notes', 'Training', 'Pests', 'Added', 'Last updated'] },
  ];
  const allFields: DetailField[] = [...fields as DetailField[], ['Notes', plant.notes], ['Training', plant.trainingTags?.join(', ')], ['Pests', plant.pests?.join(', ')]];
  const missing = allFields.filter(([, value]) => !hasValue(value)).length;
  return <GrowReveal><SectionTitle theme={theme} title="Plant details" /><Text style={[detailStyles.body, { color: theme.muted, marginBottom: 16 }]}>Your plant’s setup and lasting notes. Dated observations live in the journal.</Text>
    {!!missing && <GrowPress accessibilityRole="button" onPress={onEdit} style={{ minHeight: 48, justifyContent: 'center', marginBottom: 12 }}><Text style={{ color: theme.accent, fontSize: 14 }}>Complete {missing} optional details →</Text></GrowPress>}
    {groups.map((group, index) => <DetailGroup key={group.title} title={group.title} fields={group.keys.map(key => allFields.find(([label]) => label === key)!).filter(Boolean)} theme={theme} initialOpen={index === 0} />)}
  </GrowReveal>;
}
