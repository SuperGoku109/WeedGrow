import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import LocationPicker from '@/features/location/LocationPicker';
import { useSavedLocations } from '@/features/location/SavedLocations';
import { validCoordinates, coordinateLabel, type Coordinates } from '@/features/location/locationService';
import { Icon, palette, Press, s } from './FlowUI';
import type { StepProps } from './FlowSteps';

export default function PlantCreationLocation({ form, setField, onBusyChange }: Pick<StepProps, 'form' | 'setField' | 'onBusyChange'>) {
  const { spaces, loading, error, retry } = useSavedLocations();
  const garden = spaces.find(item => item.id === form.groupId);
  const name = garden?.name || form.groupName || 'your garden';
  const usesGarden = !!form.groupId && form.locationMode === 'space';
  const custom = React.useRef<{ location: Coordinates | null; label: string; nickname: string } | null>(null);
  const source = React.useRef(form.groupId);
  if (source.current !== form.groupId) { source.current = form.groupId; custom.current = null; }
  const updateLocation = (location: Coordinates | null, label: string) => {
    setField('location', location); setField('locationLabel', label);
    setField('latitudeInput', location ? String(location.lat) : '');
    setField('longitudeInput', location ? String(location.lng) : '');
  };
  const useDifferent = () => {
    setField('locationMode', 'custom');
    setField('locationNickname', custom.current?.nickname || '');
    updateLocation(custom.current?.location || null, custom.current?.label || '');
  };
  const useGarden = () => {
    if (!garden) return;
    custom.current = { location: form.location || null, label: form.locationLabel || '', nickname: form.locationNickname || '' };
    setField('locationMode', 'space'); setField('locationNickname', garden.name);
    updateLocation(garden.location, garden.locationLabel || garden.name);
  };
  if (usesGarden) return <View style={{ gap: 14 }}>
    <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.panel, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="map-marker-check-outline" size={24} /><Text style={[s.label, { flex: 1 }]}>Using {name}’s location</Text></View>
      {loading && !garden ? <ActivityIndicator accessibilityLabel="Loading garden location" color={palette.accent} /> : error ? <><Text accessibilityRole="alert" style={s.error}>We couldn’t load the garden’s location.</Text><Press label="Retry garden location" onPress={retry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: palette.accent }}>Try again</Text></Press></> : !garden ? <Text style={s.error}>This garden is unavailable. Choose another garden in Setup.</Text> : validCoordinates(garden.location) ? <><Text style={{ color: palette.ink, fontSize: 16, lineHeight: 23 }}>{garden.locationLabel && garden.locationLabel !== garden.name ? garden.locationLabel : coordinateLabel(garden.location)}</Text><Text style={s.hint}>If you change {name}’s location later, this plant updates too.</Text></> : <Text style={s.hint}>{name} has no saved location yet. You can add one in Garden settings later.</Text>}
    </View>
    <Press label="Use a different location for this plant" onPress={useDifferent} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="map-marker-outline" size={20} /><Text style={{ flex: 1, color: palette.accent, fontSize: 14, fontWeight: '600' }}>Use a different location</Text><Icon name="chevron-right" size={20} /></Press>
  </View>;
  return <View style={{ gap: 16 }}>
    {!!form.groupId && <View style={{ gap: 4 }}><Text style={s.hint}>This location applies only to this plant.</Text><Press label={`Use ${name}'s location`} disabled={!garden || loading || !!error} onPress={useGarden} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="arrow-u-left-top" size={18} /><Text style={{ flex: 1, color: palette.accent, fontSize: 14 }}>Use {name}’s location</Text></Press></View>}
    <LocationPicker minimal compactFlow allowSaved={false} location={form.location} label={form.locationLabel} onBusyChange={onBusyChange} onChange={updateLocation} />
    {!validCoordinates(form.location) && <Text style={s.hint}>You can leave this blank and add a location later.</Text>}
  </View>;
}
