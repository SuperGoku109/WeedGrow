import React from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress, GrowReveal, useReducedMotion } from '@/ui/GrowMotion';
import type { Plant, WeatherCacheEntry } from '@/firestoreModels';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import type { PlantTheme } from './plantDetailTheme';

export const detailStyles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.6 },
  eyebrow: { fontFamily: 'SpaceMono', fontSize: 9, letterSpacing: 1.4 },
  body: { fontSize: 13, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 23, padding: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { borderRadius: 22, paddingHorizontal: 17, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
});
export function SectionTitle({ title, caption, theme }: { title: string; caption?: string; theme: PlantTheme }) {
  return <View style={detailStyles.section}><Text style={[detailStyles.title, { color: theme.text }]}>{title}</Text>{caption && <Text style={{ color: theme.muted, fontSize: 10 }}>{caption}</Text>}</View>;
}
export function EmptyCard({ title, text, theme }: { title: string; text: string; theme: PlantTheme }) {
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.text, fontWeight: '600', marginBottom: 5 }}>{title}</Text><Text style={[detailStyles.body, { color: theme.muted }]}>{text}</Text></View>;
}
export function PlantIdentity({ plant, theme, onEdit }: { plant: Plant; theme: PlantTheme; onEdit: () => void }) {
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const reduced = useReducedMotion();
  const sway = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduced || uri) { sway.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); animation.start(); return () => animation.stop();
  }, [reduced, uri, sway]);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [uri]);
  const stage = plant.growthStage || 'Growing';
  return <GrowReveal><View style={{ backgroundColor: theme.hero, borderRadius: 28, padding: 20, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[detailStyles.eyebrow, { color: '#64724e' }]}>THE GROW JOURNAL</Text>
        <Text style={{ color: theme.heroText, fontSize: 37, lineHeight: 43, fontWeight: '800', letterSpacing: -1.7, marginTop: 10 }}>{plant.name}</Text>
        <Text style={{ color: '#556448', fontSize: 13, marginTop: 3 }}>{plant.strain || 'Strain not set'}</Text>
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#cfddb4', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, marginTop: 12 }}><Text style={{ color: '#3c5631', fontSize: 10, textTransform: 'capitalize', fontWeight: '700' }}>{stage} · {plant.status || 'active'}</Text></View>
      </View>
      {uri && !broken ? <Image source={{ uri }} onError={() => setBroken(true)} style={{ width: 100, height: 132, borderRadius: 48, backgroundColor: '#cfddb4' }} /> : <Animated.View style={{ width: 88, height: 124, borderRadius: 45, backgroundColor: '#d9e5bd', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['5deg', '10deg'] }) }, { translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}><MaterialCommunityIcons name="sprout" size={62} color="#47633a" /><Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#64724e' }}>GROW SLOW</Text></Animated.View>}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderColor: '#cdd9b5', marginTop: 18, paddingTop: 12 }}>
      <Text style={{ color: '#526444', fontSize: 11, textTransform: 'capitalize', flex: 1 }}>{plant.environment} · {plant.locationNickname || (plant.plantedIn === 'pot' ? 'Potted plant' : 'In the ground')}</Text>
      <GrowPress accessibilityRole="button" accessibilityLabel="Edit plant details" onPress={onEdit} style={{ flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 36 }}><MaterialCommunityIcons name="pencil-outline" size={14} color="#39552e" /><Text style={{ color: '#39552e', fontSize: 11, fontWeight: '700' }}>Edit plant</Text></GrowPress>
    </View>
  </View></GrowReveal>;
}
function metric(value?: number | null, unit = '') { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}${unit}` : '—'; }
export function WeatherPanel({ weather, theme, label, loading, error }: { weather?: WeatherCacheEntry; theme: PlantTheme; label: string; loading?: boolean; error?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!weather) return <EmptyCard theme={theme} title={loading ? 'Loading the forecast…' : 'No weather recorded'} text={error || 'Weather appears here when a forecast is available for this location and date.'} />;
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}><Text style={[detailStyles.eyebrow, { color: theme.muted }]}>{label.toUpperCase()}</Text><Text style={{ color: theme.text, fontSize: 34, fontWeight: '600', letterSpacing: -1, marginTop: 6 }}>{metric(weather.temperature ?? weather.detailedTemps?.day, '°')}<Text style={{ fontSize: 15 }}>C</Text></Text><Text style={{ color: theme.muted, fontSize: 12, textTransform: 'capitalize' }}>{weather.weatherSummary || 'Conditions recorded'}</Text></View>
      <MaterialCommunityIcons name={weather.weatherSummary?.includes('rain') ? 'weather-rainy' : weather.weatherSummary?.includes('cloud') ? 'weather-partly-cloudy' : 'weather-sunny'} size={48} color={theme.warm} />
    </View>
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: theme.border, marginTop: 15, paddingTop: 14 }}>
      {[['Humidity', metric(weather.humidity, '%')], ['Rain', metric(weather.rainfall, ' mm')], ['High / low', `${metric(weather.detailedTemps?.max, '°')} / ${metric(weather.detailedTemps?.min, '°')}`]].map(([title, value]) => <View key={title} style={{ flex: 1 }}><Text style={{ color: theme.muted, fontSize: 9, marginBottom: 5 }}>{title}</Text><Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{value}</Text></View>)}
    </View>
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ paddingTop: 14, paddingBottom: 5, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.water, fontSize: 11 }}>Weather details · {weather.forecasted ? 'Forecast' : 'Recorded'}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.muted} /></GrowPress>
    {expanded && <GrowReveal><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingTop: 10 }}>
      {[['Wind', metric(weather.windSpeed, ' m/s')], ['Gusts', metric(weather.windGust, ' m/s')], ['UV index', metric(weather.uvIndex)], ['Dew point', metric(weather.dewPoint, '°')], ['Cloud cover', metric(weather.cloudCoverage, '%')], ['Rain chance', metric(typeof weather.pop === 'number' ? weather.pop <= 1 ? weather.pop * 100 : weather.pop : null, '%')], ['Night humidity', metric(weather.nightHumidity, '%')], ['Morning', metric(weather.detailedTemps?.morn, '°')], ['Evening', metric(weather.detailedTemps?.eve, '°')], ['Night', metric(weather.detailedTemps?.night, '°')]].map(([key, value]) => <View key={key} style={{ width: '43%' }}><Text style={{ color: theme.muted, fontSize: 10 }}>{key}</Text><Text style={{ color: theme.text, fontSize: 13, marginTop: 3 }}>{value}</Text></View>)}
    </View>{weather.source && <Text style={{ color: theme.muted, fontSize: 9, marginTop: 14 }}>Source: {weather.source}</Text>}</GrowReveal>}
  </View>;
}
export function InsightPanel({ card, theme }: { card: SuggestionCard; theme: PlantTheme }) {
  const [expanded, setExpanded] = React.useState(false);
  const color = card.severity === 'critical' || card.severity === 'warn' ? theme.danger : card.severity === 'watch' ? theme.warm : theme.accent;
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 9, padding: 14 }]}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${card.title}. ${expanded ? 'Hide' : 'Show'} explanation`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <MaterialCommunityIcons name={card.kind === 'watering' ? 'water-outline' : card.kind === 'rootRot' ? 'sprout-outline' : 'leaf'} size={22} color={color} />
      <View style={{ flex: 1 }}><Text style={{ color, fontFamily: 'SpaceMono', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{card.severity} · {card.confidence} confidence</Text><Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>{card.title}</Text></View>
      <MaterialCommunityIcons name={expanded ? 'minus' : 'plus'} size={16} color={theme.muted} />
    </GrowPress>
    {expanded && <GrowReveal><Text style={[detailStyles.body, { color: theme.muted, marginTop: 12 }]}>{card.summary}</Text>{Array.from(new Set(card.reasons)).filter(reason => reason !== card.summary).map(reason => <Text key={reason} style={[detailStyles.body, { color: theme.muted, marginTop: 6 }]}>• {reason}</Text>)}</GrowReveal>}
  </View>;
}
export function PlantDetails({ plant, theme, onEdit }: { plant: Plant; theme: PlantTheme; onEdit: () => void }) {
  const fields = [ ['Growth stage', plant.growthStage], ['Status', plant.status], ['Added', plant.createdAt?.toDate?.().toLocaleDateString('en-GB')], ['Last updated', plant.updatedAt?.toDate?.().toLocaleDateString('en-GB')], ['Strain', plant.strain], ['Age', plant.ageDays != null ? `${plant.ageDays} days` : undefined], ['Height', plant.height != null ? `${plant.height} cm` : undefined], ['Environment', plant.environment], ['Planted in', plant.plantedIn], ['Pot size', plant.potSize], ['Sunlight', plant.sunlightExposure], ['Watering schedule', plant.wateringFrequency], ['Fertilizer', plant.fertilizer], ['Location', plant.locationNickname], ['Coordinates', plant.location ? `${plant.location.lat.toFixed(4)}, ${plant.location.lng.toFixed(4)}` : undefined], ['Sensor profile', plant.sensorProfileId], ['Reminder', plant.reminderSchedule ? `${plant.reminderSchedule.type}${plant.reminderSchedule.intervalDays ? ` · every ${plant.reminderSchedule.intervalDays} days` : ''}${plant.reminderSchedule.customDays?.length ? ` · ${plant.reminderSchedule.customDays.join(', ')}` : ''}${plant.reminderSchedule.timeOfDay ? ` · ${plant.reminderSchedule.timeOfDay}` : ''}` : undefined] ];
  return <GrowReveal><SectionTitle theme={theme} title="Plant passport" caption="THE LITTLE DETAILS" /><View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    {fields.map(([key, value]) => <View key={key} style={{ paddingVertical: 11, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', gap: 16 }}><Text style={{ color: theme.muted, fontSize: 12, width: '40%' }}>{key}</Text><Text selectable style={{ color: theme.text, fontSize: 12, flex: 1, textTransform: 'capitalize' }}>{value || 'Not set'}</Text></View>)}
    <GrowPress accessibilityRole="button" onPress={onEdit} style={[detailStyles.button, { backgroundColor: theme.elevated, marginTop: 15 }]}><Text style={{ color: theme.accent, fontWeight: '700' }}>Edit plant details</Text></GrowPress>
  </View>
  {([['Training', plant.trainingTags], ['Pests', plant.pests]] as const).map(([title, tags]) => <View key={title}><SectionTitle title={title} theme={theme} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tags?.length ? tags.map(tag => <View key={tag} style={{ backgroundColor: theme.elevated, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 }}><Text style={{ color: theme.text, fontSize: 12 }}>{tag}</Text></View>) : <Text style={{ color: theme.muted, fontSize: 12 }}>No {title.toLowerCase()} recorded in plant details.</Text>}</View></View>)}
  <SectionTitle title="Your notes" theme={theme} /><EmptyCard theme={theme} title="A little context goes a long way." text={plant.notes || 'Add lasting notes through Edit plant. For dated observations, add a journal entry.'} />
  </GrowReveal>;
}
