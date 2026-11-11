import React from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import type { WeatherCacheEntry } from '@/firestoreModels';
import type { PlantTheme } from './plantDetailTheme';

type Props = { weather?: WeatherCacheEntry; theme: PlantTheme; label: string; loading?: boolean; error?: string; compact?: boolean; onRefresh?(): void; refreshing?: boolean; status?: string; note?: string };
function metric(value?: number | null, unit = '') { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}${unit}` : '—'; }
export default function WeatherPanel({ weather, theme: t, label, loading, error, onRefresh, refreshing = false, status, note }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const sourceLabel = weather?.forecasted ? 'Forecast' : weather?.temperatureBasis === 'model' ? 'Modelled conditions' : weather?.observationUtc !== undefined ? 'Observed conditions' : 'Recorded conditions';
  const refresh = onRefresh && <GrowPress accessibilityRole="button" accessibilityLabel="Refresh plant weather" accessibilityState={{ busy: refreshing, disabled: refreshing }} disabled={refreshing} onPress={onRefresh} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>{refreshing ? <ActivityIndicator size="small" color={t.accent} /> : <MaterialCommunityIcons name="refresh" size={22} color={t.muted} />}</GrowPress>;
  const primary = weather ? [
    { label: 'Temperature', value: metric(weather.temperature ?? weather.detailedTemps?.day, '°C'), icon: 'thermometer' as const },
    { label: 'Humidity', value: metric(weather.humidity, '%'), icon: 'water-percent' as const },
    { label: weather.rainIntervalSeconds ? `Rain · ${weather.rainIntervalSeconds / 60} min` : 'Rain', value: metric(weather.rainfall, ' mm'), icon: 'weather-rainy' as const },
  ] : [];
  const details = weather ? [
    ['Forecast high / low', `${metric(weather.detailedTemps?.max, '°')} / ${metric(weather.detailedTemps?.min, '°')}`],
    ['Wind', metric(weather.windSpeed, ' m/s')], ['Gusts', metric(weather.windGust, ' m/s')],
    [weather.temperatureBasis === 'model' && !weather.forecasted ? 'Recent hourly mean UV' : 'UV index', metric(weather.uvIndex)],
    ['Dew point', metric(weather.dewPoint, '°')], ['Cloud cover', metric(weather.cloudCoverage, '%')],
    ['Rain chance', metric(typeof weather.pop === 'number' ? weather.pop <= 1 ? weather.pop * 100 : weather.pop : null, '%')],
    [weather.temperatureBasis === 'model' ? 'Forecast night mean RH' : 'Night humidity', metric(weather.nightHumidity, '%')],
    [weather.temperatureBasis === 'model' ? 'Forecast at 06:00' : 'Forecast morning', metric(weather.detailedTemps?.morn, '°')],
    [weather.temperatureBasis === 'model' ? 'Forecast at 18:00' : 'Forecast evening', metric(weather.detailedTemps?.eve, '°')],
    [weather.temperatureBasis === 'model' ? 'Forecast at 23:00' : 'Forecast night', metric(weather.detailedTemps?.night, '°')],
  ] : [];
  return <View style={{ backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 10 }}>
      <MaterialCommunityIcons name="map-marker-outline" size={19} color={t.muted} accessible={false} style={{ width: 20 }} />
      <View style={{ flex: 1, gap: 4, paddingVertical: 8 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>{label}</Text><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{weather ? sourceLabel : error ? 'Weather unavailable' : loading ? 'Loading conditions…' : 'No weather recorded'}</Text></View>
      {refresh}
    </View>
    {!weather && <View style={{ paddingBottom: 16, gap: 8 }}><Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{error || 'Weather appears here when a forecast is available for this location and date.'}</Text>{note && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{note}</Text>}</View>}
    {weather && <>
      <View style={{ borderTopWidth: 1, borderColor: t.elevated, flexDirection: 'row', paddingVertical: 16 }}>{primary.map((item, index) => <View key={item.label} style={{ flex: 1, minWidth: 0, gap: 6, paddingLeft: index ? 12 : 0, paddingRight: index < primary.length - 1 ? 12 : 0, borderLeftWidth: index ? 1 : 0, borderColor: t.elevated }}><Text style={{ color: t.text, fontSize: 20, lineHeight: 26, fontWeight: '600' }}>{item.value}</Text><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{item.label}</Text></View>)}</View>
      {(status || note || error || weather.forecastIssue || !!weather.qualityNotes?.length) && <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: t.elevated, gap: 8 }}>
        {status && <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{status}</Text>}
        {note && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{note}</Text>}
        {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, lineHeight: 20 }}>{error}</Text>}
        {weather.forecastIssue && <Text accessibilityRole="alert" style={{ color: t.warm, fontSize: 13, lineHeight: 20 }}>Daily forecast unavailable. Current conditions are shown; forecast highs, lows and time-of-day readings are unavailable.</Text>}
        {weather.qualityNotes?.map((value, index) => <Text key={index} selectable style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{value}</Text>)}
      </View>}

      {expanded && <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingBottom: 16 }}>
        {!!weather.weatherSummary && <Text style={{ color: t.text, fontSize: 14, lineHeight: 20, paddingVertical: 14 }}>{weather.weatherSummary}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 }}>{details.map(([key, value]) => <View key={key} style={{ flexBasis: '45%', flexGrow: 1, minWidth: 100, justifyContent: 'space-between', gap: 4, paddingVertical: 10, borderTopWidth: 1, borderColor: t.elevated }}><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{key}</Text><Text style={{ color: t.text, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{value}</Text></View>)}</View>
        {!!weather.source && weather.source !== 'Open-Meteo' && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18, marginTop: 12 }}>Source: {weather.source}</Text>}
        {weather.source === 'Open-Meteo' && <GrowPress accessibilityRole="link" accessibilityLabel="Source: Open-Meteo. Weather licence and attribution" onPress={() => { void Linking.openURL('https://open-meteo.com/en/licence'); }} style={{ minHeight: 48, justifyContent: 'center', marginTop: 8 }}><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline' }}>Source: Open-Meteo</Text></GrowPress>}
      </View>}
      <View style={{ borderTopWidth: 1, borderColor: t.elevated }}><GrowPress accessibilityRole="button" accessibilityLabel={expanded ? 'Hide weather details' : 'View weather details'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: t.accent, fontSize: 13, fontWeight: '500' }}>{expanded ? 'Less detail' : 'More detail'}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={t.muted} /></GrowPress></View>
    </>}
  </View>;
}
