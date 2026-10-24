import React from 'react';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { validCoordinates, type Coordinates } from '@/features/location/locationService';
import { MAP_ATTRIBUTION, MAP_DEFAULT, MAP_TILES } from './mapConfig';

export interface MapPickerProps { location?: Coordinates; onLocationChange(coords: Coordinates): void; disabled?: boolean; height?: number; centerRequest?: number }
export function MapPicker({ location, onLocationChange, disabled = false, height = 300, centerRequest = 0 }: MapPickerProps) {
  const container = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<Leaflet.Map | null>(null);
  const marker = React.useRef<Leaflet.Marker | null>(null);
  const leaflet = React.useRef<typeof Leaflet | null>(null);
  const latest = React.useRef({ location, onLocationChange, disabled });
  latest.current = { location, onLocationChange, disabled };
  const [error, setError] = React.useState('');
  const [ready, setReady] = React.useState(false);
  const [tilesLoading, setTilesLoading] = React.useState(true);
  const [generation, setGeneration] = React.useState(0);
  const [attempt, retry] = React.useReducer(value => value + 1, 0);
  const select = React.useCallback((latlng: Leaflet.LatLng) => {
    const coords = { lat: latlng.lat, lng: latlng.wrap().lng };
    if (!latest.current.disabled && validCoordinates(coords)) latest.current.onLocationChange(coords);
  }, []);
  React.useEffect(() => {
    let active = true;
    let resize: ResizeObserver | undefined;
    setReady(false); setTilesLoading(true); setError('');
    import('leaflet').then(L => {
      if (!active || !container.current) return;
      leaflet.current = L;
      const initial = validCoordinates(latest.current.location) ? latest.current.location : MAP_DEFAULT;
      const instance = L.map(container.current, { scrollWheelZoom: false, worldCopyJump: true }).setView([initial.lat, initial.lng], latest.current.location ? 13 : 5);
      map.current = instance;
      L.tileLayer(MAP_TILES, { maxZoom: 19, attribution: MAP_ATTRIBUTION, updateWhenIdle: true, keepBuffer: 1 })
        .on('loading', () => { if (active) setTilesLoading(true); })
        .on('load', () => { if (active) setTilesLoading(false); })
        .on('tileerror', () => { if (active) { setTilesLoading(false); setError('Some map tiles could not load. Check your connection or retry the map.'); } }).addTo(instance);
      instance.on('click', (event: Leaflet.LeafletMouseEvent) => select(event.latlng));
      resize = new ResizeObserver(() => instance.invalidateSize()); resize.observe(container.current);
      setReady(true); setGeneration(value => value + 1);
    }).catch(() => { if (active) { setTilesLoading(false); setError('The map could not load. Retry or enter coordinates below.'); } });
    return () => { active = false; resize?.disconnect(); map.current?.remove(); map.current = null; marker.current = null; };
  }, [attempt, select]);
  React.useEffect(() => {
    if (ready && !tilesLoading) return;
    const deadline = setTimeout(() => { setTilesLoading(false); setError('Map imagery is taking too long. Retry the map or enter coordinates.'); }, 15000);
    return () => clearTimeout(deadline);
  }, [ready, tilesLoading, attempt]);
  React.useEffect(() => {
    const L = leaflet.current; const instance = map.current;
    if (!ready || !L || !instance) return;
    if (!validCoordinates(location)) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      const icon = L.divIcon({ className: '', html: '<span style="display:block;width:26px;height:26px;background:#39854d;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 7px #0008"></span>', iconSize: [28, 36], iconAnchor: [14, 34] });
      marker.current = L.marker([location.lat, location.lng], { draggable: !disabled, icon, title: 'Selected location. Drag to adjust.' }).on('dragend', () => { if (marker.current) select(marker.current.getLatLng()); }).addTo(instance);
    } else marker.current.setLatLng([location.lat, location.lng]);
    if (disabled) marker.current.dragging?.disable(); else marker.current.dragging?.enable();
    if (!instance.getBounds().pad(-0.2).contains([location.lat, location.lng]) || instance.getZoom() < 10) instance.setView([location.lat, location.lng], Math.max(instance.getZoom(), 13), { animate: false });
  }, [location, ready, disabled, select, generation]);
  React.useEffect(() => {
    if (!centerRequest || !ready || !map.current) return;
    const point = validCoordinates(latest.current.location) ? latest.current.location : MAP_DEFAULT;
    map.current.setView([point.lat, point.lng], latest.current.location ? 15 : 5, { animate: false });
  }, [centerRequest, ready, generation]);
  return <View style={{ gap: 8 }}>
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <div ref={container} aria-label="Location map. Click to place a pin, drag the pin to adjust, or use the center button." style={{ height: '100%', width: '100%', isolation: 'isolate', pointerEvents: disabled ? 'none' : 'auto', background: '#dce5d7' }} />
      {(!ready || tilesLoading) && !error && <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 12, right: 12, padding: 10, borderRadius: 10, backgroundColor: '#1c2c22', flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator size="small" color="#d2e4a2" /><Text style={{ color: '#edf0e3', fontSize: 12 }}>{ready ? 'Loading map imagery…' : 'Opening map…'}</Text></View>}
    </View>
    {!!error && <><Text accessibilityRole="alert" style={{ color: '#f0bb8b' }}>{error}</Text><Pressable accessibilityRole="button" onPress={retry} disabled={disabled} style={{ padding: 10 }}><Text style={{ color: '#d2e4a2' }}>Retry map</Text></Pressable></>}
    <Pressable accessibilityRole="button" disabled={!ready || disabled} onPress={() => { if (map.current) select(map.current.getCenter()); }} style={({ pressed }) => ({ minHeight: 44, paddingVertical: 10, opacity: pressed || !ready || disabled ? 0.5 : 1 })}><Text style={{ color: '#d2e4a2', fontSize: 13 }}>Place pin at map center</Text></Pressable>
  </View>;
}
