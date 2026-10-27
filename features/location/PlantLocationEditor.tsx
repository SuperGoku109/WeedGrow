import React from 'react';
import { Pressable, Text, View } from 'react-native';
import LocationPicker from './LocationPicker';
import { defaultLocationTheme, type LocationTheme } from './locationTheme';
import { useSavedLocations } from './SavedLocations';
import type { Coordinates } from './locationService';
export default function PlantLocationEditor({ groupId, mode = 'custom', onModeChange, displayName, theme = defaultLocationTheme, ...props }: { displayName?: string; theme?: LocationTheme; groupId?: string | null; mode?: 'custom' | 'space'; onModeChange(mode: 'custom' | 'space'): void; location?: Coordinates | null; label?: string; onChange(coords: Coordinates | null, label: string): void; disabled?: boolean; onBusyChange?(busy: boolean): void }) {
  const t = theme;
  const { spaces, loading, error } = useSavedLocations();
  const space = spaces.find(item => item.id === groupId);
  return <View style={{ gap: 14 }}>
    {!!groupId && <View style={{ padding: 14, backgroundColor: t.surface, borderRadius: 12, gap: 10 }}><Text style={{ color: t.text, fontWeight: '600' }}>Location source</Text>{(['space', 'custom'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} disabled={props.disabled || (value === 'space' && (!space || loading))} onPress={() => { onModeChange(value); if (value === 'space' && space) props.onChange(space.location, space.locationLabel || space.name); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: mode === value ? t.accent : t.muted }}>{mode === value ? '● ' : '○ '}{value === 'space' ? `Follow ${space?.name || 'growing space'}` : 'Use this plant’s own location'}</Text></Pressable>)}{!!error && <Text style={{ color: t.danger }}>{error}</Text>}</View>}
    {mode === 'space' && groupId ? <View style={{ gap: 8 }}><Text style={{ color: t.text }}>{space?.locationLabel || space?.name || props.label || 'Growing-space location'}</Text><Text style={{ color: t.muted }}>{space?.location ? `${space.location.lat.toFixed(5)}, ${space.location.lng.toFixed(5)}` : 'This space has no pin yet. Set one in Garden locations.'}</Text><Text style={{ color: t.muted, lineHeight: 20 }}>When this space moves, this plant follows it. Earlier weather records keep their original conditions.</Text></View> : <LocationPicker {...props} displayName={displayName} theme={t} compactFlow />}
    <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>Moving a plant changes current conditions and forecasts. Previously recorded days are never rewritten.</Text>
  </View>;
}
