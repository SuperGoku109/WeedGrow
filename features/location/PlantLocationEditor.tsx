import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LocationPicker from './LocationPicker';
import { defaultLocationTheme, type LocationTheme } from './locationTheme';
import { useSavedLocations } from './SavedLocations';
import type { Coordinates } from './locationService';
export default function PlantLocationEditor({ groupId, mode = 'custom', onModeChange, displayName, theme = defaultLocationTheme, compact = false, ...props }: { displayName?: string; theme?: LocationTheme; compact?: boolean; groupId?: string | null; mode?: 'custom' | 'space'; onModeChange(mode: 'custom' | 'space'): void; location?: Coordinates | null; label?: string; onChange(coords: Coordinates | null, label: string): void; disabled?: boolean; onBusyChange?(busy: boolean): void }) {
  const t = theme;
  const { spaces, loading, error, retry } = useSavedLocations();
  const garden = spaces.find(item => item.id === groupId);
  const name = garden?.name || 'your garden';
  const usesGarden = !!groupId && mode === 'space';
  const custom = React.useRef<{ location: Coordinates | null; label: string } | null>(null);
  const action = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={props.disabled || disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: props.disabled || disabled ? 0.5 : pressed ? 0.7 : 1 })}><MaterialCommunityIcons name="map-marker-outline" size={20} color={t.accent} /><Text style={{ flex: 1, color: t.accent, fontSize: 14 }}>{label}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={t.muted} /></Pressable>;
  return <View style={{ gap: 14 }}>
    {usesGarden ? <>
      <View style={{ padding: 16, backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MaterialCommunityIcons name="map-marker-check-outline" size={23} color={t.accent} /><Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600' }}>Using {name}’s location</Text></View>
        {loading && !garden ? <ActivityIndicator color={t.accent} accessibilityLabel="Loading garden location" /> : error ? <><Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>{action('Retry garden location', retry)}</> : <><Text style={{ color: t.text, fontSize: 14, lineHeight: 21 }}>{garden?.locationLabel || props.label || (garden?.location ? 'Saved garden location' : 'No garden location saved')}</Text><Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{garden ? `This plant updates when ${name}’s location changes.` : 'This garden is unavailable. Choose a different location for this plant.'}</Text></>}
      </View>
      {action('Use a different location', () => { onModeChange('custom'); props.onChange(custom.current?.location || null, custom.current?.label || ''); })}
    </> : <>
      {!!groupId && <><Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>This location applies only to this plant.</Text>{action(`Use ${name}’s location`, () => { if (!garden) return; custom.current = { location: props.location || null, label: props.label || '' }; onModeChange('space'); props.onChange(garden.location, garden.locationLabel || garden.name); }, !garden || loading || !!error)}</>}
      <LocationPicker {...props} minimal displayName={displayName} theme={t} compactFlow />
    </>}
    {!compact && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>Used for local weather and care advice. Past weather records keep their original location.</Text>}
  </View>;
}
