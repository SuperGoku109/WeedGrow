import PlantActionButton, { PlantIconButton } from './PlantActionButton';
import React from 'react';
import { StyleSheet, Text, View, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress, GrowReveal } from '@/ui/GrowMotion';
import type { WeatherCacheEntry } from '@/firestoreModels';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import type { PlantTheme } from './plantDetailTheme';
import CareDiagnosticDetails from './CareDiagnosticDetails';

export const detailStyles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  eyebrow: { fontSize: 13, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
export function SectionTitle({ title, caption, theme }: { title: string; caption?: string; theme: PlantTheme }) {
  return <View style={[detailStyles.section, { flexWrap: 'wrap' }]}><Text style={[detailStyles.title, { color: theme.text }]}>{title}</Text>{!!caption && <Text style={{ color: theme.muted, fontSize: 13 }}>{caption}</Text>}</View>;
}
export function EmptyCard({ title, text, theme }: { title: string; text: string; theme: PlantTheme }) {
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.text, fontWeight: '600', marginBottom: 5 }}>{title}</Text><Text style={[detailStyles.body, { color: theme.muted }]}>{text}</Text></View>;
}
function metric(value?: number | null, unit = '') { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}${unit}` : '—'; }
export function WeatherPanel({ weather, theme, label, loading, error, compact = false, onRefresh, refreshing = false }: { onRefresh?(): void; refreshing?: boolean; compact?: boolean; weather?: WeatherCacheEntry; theme: PlantTheme; label: string; loading?: boolean; error?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const refreshButton = onRefresh ? <PlantIconButton label="Refresh plant weather" icon="refresh" theme={theme} onPress={onRefresh} busy={refreshing} /> : null;
  if (!weather) return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border, gap: 10 }]}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, color: theme.text, fontWeight: '600' }}>{error ? 'Weather unavailable' : loading ? 'Loading conditions…' : 'No weather recorded'}</Text>{refreshButton}</View><Text style={[detailStyles.body, { color: theme.muted }]}>{error || 'Weather appears here when a forecast is available for this location and date.'}</Text></View>;
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, color: theme.muted, fontSize: 13, lineHeight: 20 }}>{label} · {weather.forecasted ? 'Forecast' : weather.temperatureBasis === 'model' ? 'Modelled conditions' : weather.observationUtc !== undefined ? 'Observed conditions' : 'Recorded'}</Text>{refreshButton}</View>
    {weather.forecastIssue && <Text accessibilityRole="alert" selectable style={{ color: theme.warm, fontSize: 13, lineHeight: 19, marginTop: 12 }}>Daily forecast unavailable: One Call returned one daily row and at most one hourly row with the current temperature repeated in every daily field. Current conditions use OpenWeather’s Current Weather endpoint. High, low, morning, evening and night temperatures are unavailable. Code: repeated_point_forecast.</Text>}
    {weather.observationUtc !== undefined && <Text style={{ color: theme.muted, fontSize: 12, marginTop: 6 }}>{weather.temperatureBasis === 'model' ? 'Model valid at' : 'Observation'}: {new Date(weather.observationUtc * 1000).toLocaleString()}</Text>}
    {weather.qualityNotes?.map((note, i) => <Text key={i} selectable style={{ color: theme.muted, fontSize: 12, marginTop: 6 }}>{note}</Text>)}
    {compact ? <><View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>{[['Temperature', metric(weather.temperature ?? weather.detailedTemps?.day, '°C')], ['Humidity', metric(weather.humidity, '%')], [weather.rainIntervalSeconds ? `Rain (${weather.rainIntervalSeconds / 60} min)` : 'Rain', metric(weather.rainfall, ' mm')]].map(([title, value]) => <View key={title} style={{ flex: 1 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{title}</Text><Text style={{ color: theme.text, fontSize: 19, fontWeight: '600', marginTop: 6 }}>{value}</Text></View>)}</View></> : <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}><Text style={{ color: theme.text, fontSize: 34, fontWeight: '600', letterSpacing: -1, marginTop: 6 }}>{metric(weather.temperature ?? weather.detailedTemps?.day, '°')}<Text style={{ fontSize: 15 }}>C</Text></Text><Text style={{ color: theme.muted, fontSize: 13, textTransform: 'capitalize' }}>{weather.weatherSummary || 'Conditions recorded'}</Text></View>
      <MaterialCommunityIcons name={weather.weatherSummary?.toLowerCase().includes('rain') ? 'weather-rainy' : weather.weatherSummary?.toLowerCase().includes('cloud') ? 'weather-cloudy' : 'weather-sunny'} size={48} color={theme.warm} />
    </View>
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: theme.border, marginTop: 15, paddingTop: 14 }}>
      {[['Humidity', metric(weather.humidity, '%')], [weather.rainIntervalSeconds ? `Rain (${weather.rainIntervalSeconds / 60} min)` : 'Rain', metric(weather.rainfall, ' mm')], ['Forecast high / low', `${metric(weather.detailedTemps?.max, '°')} / ${metric(weather.detailedTemps?.min, '°')}`]].map(([title, value]) => <View key={title} style={{ flex: 1 }}><Text style={{ color: theme.muted, fontSize: 13, marginBottom: 5 }}>{title}</Text><Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{value}</Text></View>)}
    </View>
    </>}
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, marginTop: 14, paddingHorizontal: 12, borderRadius: 10, backgroundColor: theme.elevated, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: theme.water, fontSize: 13 }}>{expanded ? 'Hide weather details' : 'View weather details'}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.muted} /></GrowPress>
    {expanded && <GrowReveal>{compact && <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>{weather.weatherSummary || 'Conditions recorded'} · Forecast high {metric(weather.detailedTemps?.max, '°')} / Low {metric(weather.detailedTemps?.min, '°')}</Text>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingTop: 10 }}>
      {[['Wind', metric(weather.windSpeed, ' m/s')], ['Gusts', metric(weather.windGust, ' m/s')], [weather.temperatureBasis === 'model' && !weather.forecasted ? 'Recent hourly mean UV' : 'UV index', metric(weather.uvIndex)], ['Dew point', metric(weather.dewPoint, '°')], ['Cloud cover', metric(weather.cloudCoverage, '%')], ['Rain chance', metric(typeof weather.pop === 'number' ? weather.pop <= 1 ? weather.pop * 100 : weather.pop : null, '%')], [weather.temperatureBasis === 'model' ? 'Forecast night mean RH' : 'Night humidity', metric(weather.nightHumidity, '%')], [weather.temperatureBasis === 'model' ? 'Forecast at 06:00' : 'Forecast morning', metric(weather.detailedTemps?.morn, '°')], [weather.temperatureBasis === 'model' ? 'Forecast at 18:00' : 'Forecast evening', metric(weather.detailedTemps?.eve, '°')], [weather.temperatureBasis === 'model' ? 'Forecast at 23:00' : 'Forecast night', metric(weather.detailedTemps?.night, '°')]].map(([key, value]) => <View key={key} style={{ width: '43%' }}><Text style={{ color: theme.muted, fontSize: 13 }}>{key}</Text><Text style={{ color: theme.text, fontSize: 13, marginTop: 3 }}>{value}</Text></View>)}
    </View>{weather.source === 'Open-Meteo' && <GrowPress accessibilityRole="link" accessibilityLabel="Weather data by Open-Meteo" onPress={() => { void Linking.openURL('https://open-meteo.com/'); }}><Text style={{ color: theme.water, fontSize: 12, marginTop: 12 }}>Weather data by Open-Meteo · CC BY 4.0 · model estimates; displayed summaries derived by this app</Text></GrowPress>}{weather.source && <Text style={{ color: theme.muted, fontSize: 13, marginTop: 14 }}>Source: {weather.source}</Text>}</GrowReveal>}
  </View>;
}
export function InsightPanel({ card, theme, expanded, onToggle, onRecord }: { card: SuggestionCard; theme: PlantTheme; expanded: boolean; onToggle(): void; onRecord?(): void }) {
  const color = card.severity === 'critical' ? theme.danger : ['warn', 'watch'].includes(card.severity) ? theme.warm : theme.accent;
  const severity = { critical: 'Urgent', warn: 'Needs attention', watch: 'Watch', info: 'Care note' }[card.severity];
  return <View>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${severity}: ${card.title}. ${expanded ? 'Hide' : 'Show'} explanation`} accessibilityState={{ expanded }} onPress={onToggle} style={{ minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <MaterialCommunityIcons name={card.kind === 'watering' ? 'water-outline' : card.kind === 'rootRot' ? 'sprout-outline' : 'leaf'} size={21} color={card.kind === 'watering' ? theme.water : color} />
      <View style={{ flex: 1, gap: 2 }}><Text style={{ color, fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{severity}</Text><Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>{card.title}</Text></View>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.muted} />
    </GrowPress>
    {expanded && <GrowReveal style={{ paddingHorizontal: 14, paddingBottom: 14 }}><Text style={[detailStyles.body, { color: theme.muted }]}>{card.summary}</Text>{Array.from(new Set(card.reasons)).filter(reason => !card.summary.toLowerCase().includes(reason.toLowerCase())).map(reason => <Text key={reason} style={[detailStyles.body, { color: theme.muted, marginTop: 6 }]}>• {reason}</Text>)}<Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 10, textTransform: 'capitalize' }}>{card.metrics.experimental ? card.metrics.weatherDriven ? 'On-device experiment · Model weather and test profile' : 'On-device experiment · Assumed weather and test profile' : card.algorithmVersion.startsWith('hops-') && card.metrics.needsWater === null ? 'No supported watering estimate' : `${card.confidence} confidence · Weather-based suggestion`}</Text>{card.kind === 'watering' && !!card.diagnostics?.length && <CareDiagnosticDetails entries={card.diagnostics} theme={theme} />}{onRecord && <View style={{ marginTop: 12, alignSelf: 'flex-start' }}><PlantActionButton label={card.kind === 'watering' ? 'Record soil check' : 'Log observation'} icon="notebook-plus-outline" theme={theme} onPress={onRecord} /></View>}</GrowReveal>}
  </View>;
}

export { default as PlantDetails } from './PlantDetails';
