import React from 'react';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { Plant, WeatherCacheEntry } from '@/firestoreModels';
import { refreshPlantWeather } from '@/lib/weather/refreshPlantWeather';
import { weatherMatchesLocation } from '@/features/location/locationState';
import { plantDay } from '@/lib/dates/plantDay';
import { WeatherPanel } from './PlantDetailPanels';
import type { PlantTheme } from './plantDetailTheme';
import { weatherFreshness } from '../plantCare';
export default function PlantWeather({ plantId, plant, weather, date, theme, compact = false }: { plantId: string; plant: Plant; weather?: WeatherCacheEntry; date: string; theme: PlantTheme; compact?: boolean }) {
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('');
  const [otherLocations, setOtherLocations] = React.useState<WeatherCacheEntry[]>([]);
  const [historyError, setHistoryError] = React.useState('');
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [history, setHistory] = React.useState(false); const mounted = React.useRef(true); const generation = React.useRef(0);
  const clock = useMinuteClock();
  const today = plantDay(clock, plant.locationTimeZone); const historical = date < today;
  const live = date === today && plant.currentWeather?.date === date && weatherMatchesLocation(plant.currentWeather, plant) ? plant.currentWeather : undefined;
  const current = live || (historical || weatherMatchesLocation(weather, plant) ? weather : undefined);
  const refresh = React.useCallback(async (force = true) => {
    if (!plant.location || date < plantDay(new Date(), plant.locationTimeZone)) return;
    const version = ++generation.current; setBusy(true); setError('');
    try { await refreshPlantWeather(plantId, { location: plant.location, locationRevision: plant.locationRevision, locationLabel: plant.locationLabel, locationTimeZone: plant.locationTimeZone, currentWeather: plant.currentWeather }, force, date); }
    catch (failure) { if (mounted.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Weather could not be refreshed. Retry later.'); }
    finally { if (mounted.current && version === generation.current) setBusy(false); }
  }, [plantId, plant.location, plant.locationRevision, plant.locationLabel, plant.locationTimeZone, plant.currentWeather, date]);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => { if (!historical && plant.location) void refresh(false); }, [refresh, historical, plant.location]);
  React.useEffect(() => {
    if (!history) return;
    let active = true; setHistoryLoading(true); setHistoryError('');
    void getDocs(query(collection(db, 'plants', plantId, 'weatherCache'), where('date', '==', date))).then(snapshot => {
      if (active) setOtherLocations(snapshot.docs.filter(item => item.id.startsWith('location_')).map(item => item.data() as WeatherCacheEntry));
    }).catch(() => { if (active) setHistoryError('Other saved locations could not be loaded. Close and reopen this list to retry.'); }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [history, plantId, date]);
  const previous = [...(live && weather && !weatherMatchesLocation(weather, plant) ? [weather] : []), ...(weather?.previousLocations || []), ...otherLocations.filter(entry => !current || entry.locationRevision !== current.locationRevision || historical)];
  return <View style={{ gap: 10 }}>
    <WeatherPanel theme={theme} compact={compact} label={historical ? 'Saved conditions' : date > today ? 'Forecast' : plant.locationLabel || plant.locationNickname || 'Current location'} weather={current} loading={busy} error={error || (!plant.location && !historical ? 'Add a location in Details to load weather.' : weather && !current ? 'This saved forecast belongs to an earlier location. Refresh to load the new location.' : '')} />
    {!!current && <Text style={{ color: theme.muted, fontSize: 12 }}>{weatherFreshness(current, clock).label}{current.locationLabel ? ` · ${current.locationLabel}` : ''}</Text>}
    {busy && <View style={{ flexDirection: 'row', gap: 8 }}><ActivityIndicator size="small" color={theme.accent} /><Text accessibilityLiveRegion="polite" style={{ color: theme.muted }}>Refreshing current conditions…</Text></View>}
    {!!error && !!current && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
    {date === today && !!weather && !current && <View style={{ padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12 }}><Text style={{ color: theme.muted }}>Earlier location saved today · {weather.locationLabel || 'Original location'}</Text><Text style={{ color: theme.text }}>{weather.temperature}°C · {weather.humidity}% humidity · saved {weather.fetchedAt?.toDate?.().toLocaleString()}</Text><Text style={{ color: theme.muted, fontSize: 12 }}>Kept for history; these are not conditions at the plant’s new location.</Text></View>}
    {!historical && !!plant.location && <Pressable accessibilityRole="button" accessibilityLabel="Refresh plant weather" disabled={busy} onPress={() => void refresh()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.accent }}>{busy ? 'Refreshing…' : 'Refresh weather'}</Text></Pressable>}
    {historical && <Text style={{ color: theme.muted, fontSize: 12 }}>Saved for this day. Moving the plant does not change these conditions.</Text>}
    {(!!weather?.previousLocations?.length || (plant.locationRevision || 0) > 0) && <><Pressable accessibilityRole="button" accessibilityState={{ expanded: history }} onPress={() => setHistory(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.accent }}>{history ? 'Hide' : 'Show'} other locations saved on this day</Text></Pressable>{history && <>{historyLoading && <Text style={{ color: theme.muted }}>Loading saved locations…</Text>}{!!historyError && <Text style={{ color: theme.danger }}>{historyError}</Text>}{!historyLoading && !historyError && !previous.length && <Text style={{ color: theme.muted }}>No other location snapshots were saved for this day.</Text>}{previous.map((entry, index) => <View key={index} style={{ padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, gap: 5 }}><Text style={{ color: theme.text }}>{entry.locationLabel || 'Earlier location'} · {entry.fetchedAt?.toDate?.().toLocaleString()}</Text><Text style={{ color: theme.muted }}>{entry.temperature}°C · {entry.humidity}% humidity · {entry.rainfall} mm recorded rain</Text></View>)}</>}</>}

  </View>;
}
