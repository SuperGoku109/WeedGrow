import React from 'react';
import { getDeviceLocation } from './deviceLocation';
import type { LocationStage } from './deviceLocationTypes';
import { coordinateLabel, nameForCoordinates, searchPlaces, validCoordinates, type Coordinates, type PlaceResult } from './locationService';

export function useLocationPicker(location: Coordinates | null | undefined, label: string, onChange: (coords: Coordinates | null, label: string) => void) {
  const [query, setQuery] = React.useState(label || (validCoordinates(location) ? coordinateLabel(location) : ''));
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [busy, setBusy] = React.useState<'search' | 'name' | 'gps' | ''>('');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [accuracy, setAccuracy] = React.useState<number | null>(null);
  const [locationStage, setLocationStage] = React.useState<LocationStage>('position');
  const sequence = React.useRef(0);
  const request = React.useRef<AbortController | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = React.useRef(onChange); latest.current = onChange;
  const cancel = React.useCallback(() => { sequence.current++; request.current?.abort(); if (timer.current) clearTimeout(timer.current); return sequence.current; }, []);
  React.useEffect(() => () => { cancel(); }, [cancel]);
  const externalLabel = label || (validCoordinates(location) ? coordinateLabel(location) : '');
  React.useEffect(() => { setQuery(externalLabel); }, [externalLabel]);
  const changeQuery = (text: string) => { cancel(); setBusy(''); setError(''); setNotice(''); setResults([]); setQuery(text); };
  const lookupName = React.useCallback((coords: Coordinates) => {
    if (!validCoordinates(coords)) return;
    const version = cancel(); const fallback = coordinateLabel(coords); setAccuracy(null);
    latest.current(coords, fallback); setQuery(fallback); setResults([]); setError(''); setNotice('Pin updated. Finding the nearest area…'); setBusy('name');
    // Resolve only a settled pin; dragging and rapid map clicks do not flood the service.
    timer.current = setTimeout(async () => {
      const controller = new AbortController(); request.current = controller;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const name = await nameForCoordinates(coords, controller.signal);
        if (version === sequence.current) { latest.current(coords, name); setQuery(name); setNotice('Location selected. Save your changes to keep it.'); }
      } catch { if (version === sequence.current) setError('The area name is unavailable. Your exact pin is kept; you can still save it.'); }
      finally { clearTimeout(timeout); if (version === sequence.current) setBusy(''); }
    }, 450);
  }, [cancel]);
  const search = async () => {
    if (query.trim().length < 2) { setError('Enter at least two characters, such as a town and country.'); return; }
    const version = cancel(); const controller = new AbortController(); request.current = controller;
    setBusy('search'); setResults([]); setError(''); setNotice('');
    const timeout = setTimeout(() => controller.abort(), 10000);
    try { const places = await searchPlaces(query, controller.signal); if (version === sequence.current) { setResults(places); if (!places.length) setError('No matching towns. Try adding the region or country, or place a pin on the map.'); else setNotice(`${places.length} ${places.length === 1 ? 'place found' : 'places found'}. Choose a result to place your pin.`); } }
    catch { if (version === sequence.current) setError('Search could not finish. Retry or choose your location on the map.'); }
    finally { clearTimeout(timeout); if (version === sequence.current) setBusy(''); }
  };
  const choose = (place: PlaceResult) => { cancel(); setAccuracy(null); setBusy(''); setResults([]); setError(''); setNotice('Location selected. Drag the pin to refine it, then save your changes.'); setQuery(place.label); latest.current({ lat: place.lat, lng: place.lng }, place.label); };
  const clear = () => { cancel(); setAccuracy(null); setBusy(''); setResults([]); setError(''); setNotice('Location removed. Save your changes to keep this change.'); setQuery(''); latest.current(null, ''); };
  const cancelAction = () => { cancel(); setBusy(''); setNotice('Cancelled. Your selected pin has been kept.'); setError(''); };
  const locate = async () => {
    const version = cancel(); const controller = new AbortController(); request.current = controller;
    setBusy('gps'); setLocationStage('permission'); setError(''); setNotice(''); setResults([]);
    try {
      const result = await getDeviceLocation(controller.signal, stage => { if (version === sequence.current) setLocationStage(stage); });
      if (version === sequence.current) {
        lookupName(result.coords);
        setAccuracy(result.accuracy);
        setNotice(result.accuracy != null ? `Device location found (about ±${Math.max(1, Math.round(result.accuracy))} m). Adjust the pin if needed.` : 'Device location found. Adjust the pin if needed.');
      }
    } catch (err) { if (version === sequence.current) { setError(err instanceof Error ? err.message : 'Your location is unavailable.'); setBusy(''); } }
  };
  return { query, results, busy, error, notice, accuracy, locationStage, changeQuery, search, choose, clear, locate, cancelAction, selectPin: lookupName };
}
