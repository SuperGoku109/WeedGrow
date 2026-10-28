import React from 'react';
import { AppState } from 'react-native';
import { refreshGardenWeather } from '@/lib/weather/refreshGardenWeather';
import { validCoordinates } from '@/features/location/locationService';
import type { HomeGarden } from './gardenSelection';

export function useGardenWeatherCollection(gardens: HomeGarden[], uid?: string) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  // Weather writes update garden snapshots; only membership/location changes restart this effect.
  const scope = JSON.stringify(gardens.filter(garden => validCoordinates(garden.location)).map(garden => [garden.id, garden.location]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  React.useEffect(() => {
    setErrors({});
    if (!uid) return;
    let active = true;
    const ids = (JSON.parse(scope) as [string, unknown][]).map(([id]) => id);
    const collect = () => { if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return; for (const id of ids) void refreshGardenWeather(id).then(() => { if (active) setErrors(previous => { const next = { ...previous }; delete next[id]; return next; }); }).catch(error => { if (active) setErrors(previous => ({ ...previous, [id]: error instanceof Error ? error.message : 'Weather could not be collected.' })); }); };
    collect();
    const timer = setInterval(collect, 15 * 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') collect(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [scope, uid]);
  const retry = async (id: string) => {
    try { await refreshGardenWeather(id, true); setErrors(previous => { const next = { ...previous }; delete next[id]; return next; }); }
    catch (error) { setErrors(previous => ({ ...previous, [id]: error instanceof Error ? error.message : 'Weather could not be collected.' })); }
  };
  return { errors, retry };
}
