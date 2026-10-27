import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { defaultLocationTheme, type LocationTheme } from './locationTheme';
import { validCoordinates, type Coordinates } from './locationService';
export function useSavedLocations() {
  const { groups, loading, error, refresh } = useOwnedGroups();
  return { spaces: groups, loading, error, retry: refresh };
}
export default function SavedLocations({ onChoose, disabled, theme: t = defaultLocationTheme }: { onChoose(coords: Coordinates, name: string): void; disabled?: boolean; theme?: LocationTheme }) {
  const [expanded, setExpanded] = React.useState(false);
  return <View style={{ gap: 8 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded }} disabled={disabled} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent, fontWeight: '600' }}>{expanded ? 'Hide saved locations' : 'Copy a saved garden pin'}</Text></Pressable>{expanded && <SavedChoices theme={t} onChoose={onChoose} disabled={disabled} />}{expanded && <Text style={{ color: t.muted, fontSize: 13 }}>Copying a pin keeps this plant independent. To move automatically with a space, assign the plant to that space and choose Follow. Manage spaces in More → Garden locations.</Text>}</View>;
}
function SavedChoices({ onChoose, disabled, theme: t = defaultLocationTheme }: { onChoose(coords: Coordinates, name: string): void; disabled?: boolean; theme?: LocationTheme }) {
  const { spaces, loading, error, retry } = useSavedLocations();
  const locations = spaces.filter(space => validCoordinates(space.location));
  return <View style={{ gap: 8 }}>{loading && <ActivityIndicator color={t.accent} />}{!!error && <Pressable accessibilityRole="button" onPress={retry}><Text style={{ color: t.danger }}>{error}</Text></Pressable>}{!loading && !locations.length && <Text style={{ color: t.muted }}>Save a location on a growing space such as Home, Patio or Greenhouse to reuse it here.</Text>}{locations.map(space => <Pressable key={space.id} accessibilityRole="button" accessibilityLabel={`Copy pin from ${space.name}`} disabled={disabled} onPress={() => onChoose(space.location!, space.locationLabel || space.name)} style={{ padding: 12, backgroundColor: t.surface, borderRadius: 10 }}><Text style={{ color: t.text, fontWeight: '600' }}>{space.name}</Text><Text style={{ color: t.muted, fontSize: 13 }}>{space.locationLabel || `${space.location!.lat.toFixed(5)}, ${space.location!.lng.toFixed(5)}`}</Text></Pressable>)}</View>;
}
