import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActionDialog from '@/ui/ActionDialog';
import { gardenThemes } from '@/design-system/tokens/garden';
import { newLogId } from '@/lib/logs/journalRepository';
import { movePlantToGarden } from '../api/movePlant';
import { gardenMoveSignature } from '../gardenMove';
import type { HomeGarden } from '@/features/home/gardenSelection';
import type { Plant } from '@/firestoreModels';

const t = gardenThemes.grove;
export default function MovePlantDialog({ plant, gardens, onClose, onMoved }: {
  plant: Plant & { id: string }; gardens: HomeGarden[]; onClose(): void; onMoved(name: string): void;
}) {
  const source = gardens.find(garden => plant.groupId ? garden.id === plant.groupId : garden.plantIds.includes(plant.id));
  const [destination, setDestination] = React.useState<HomeGarden | null>(null);
  const [follow, setFollow] = React.useState(plant.locationMode === 'space');
  const [requestId] = React.useState(newLogId);
  const crossEnvironment = !!destination && destination.environment !== plant.environment;
  return <ActionDialog title="Move to garden" description={`${plant.name} · currently ${source ? `in ${source.name}` : 'outside a garden'}. Its journal, photos and care routine stay with it.`} confirmLabel="Move plant" onClose={onClose} onConfirm={async () => {
    if (!destination) throw new Error('Choose a destination garden.');
    await movePlantToGarden({ plantId: plant.id, destinationId: destination.id, expectedGroupId: plant.groupId || null, legacySourceId: !plant.groupId ? source?.id : undefined,
      expectedPlantUpdatedAt: plant.updatedAt?.toMillis?.() || null, destinationSignature: gardenMoveSignature(destination), followGarden: follow || crossEnvironment, requestId });
    onMoved(destination.name);
  }}>{busy => <View style={{ gap: 10 }}>
    {gardens.filter(garden => garden.id !== source?.id).map(garden => <Pressable key={garden.id} accessibilityRole="radio" accessibilityLabel={`Move to ${garden.name}`} accessibilityState={{ checked: destination?.id === garden.id, disabled: busy }} disabled={busy} onPress={() => setDestination(garden)} style={{ minHeight: 64, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: destination?.id === garden.id ? t.accent : '#52684b', backgroundColor: destination?.id === garden.id ? t.elevated : t.background, flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1, gap: 4 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{garden.name}</Text><Text style={{ color: t.muted, fontSize: 13, textTransform: 'capitalize' }}>{garden.environment}{garden.locationLabel ? ` · ${garden.locationLabel}` : ''}</Text></View>{destination?.id === garden.id && <MaterialCommunityIcons name="check" size={21} color={t.accent} />}</Pressable>)}
    {gardens.filter(garden => garden.id !== source?.id).length === 0 && <Text style={{ color: t.muted, lineHeight: 21 }}>Create another garden from the garden dropdown, then move this plant here.</Text>}
    {destination && <View style={{ padding: 14, borderRadius: 14, backgroundColor: t.elevated, gap: 8 }}>
      <Text style={{ color: t.text, fontWeight: '600' }}>After the move</Text>
      <Text style={{ color: t.muted, lineHeight: 21 }}>{crossEnvironment ? `${plant.environment} → ${destination.environment}. ` : ''}{follow || crossEnvironment ? `Follow ${destination.name}'s location and sensor setup. ${destination.locationLabel || (destination.location ? 'Garden pin saved.' : 'No garden location set.')}` : 'Keep this plant’s current location and sensor setup.'} Earlier weather stays unchanged.</Text>
      {!crossEnvironment && <Pressable accessibilityRole="checkbox" accessibilityLabel="Follow destination garden settings" accessibilityState={{ checked: follow, disabled: busy }} disabled={busy} onPress={() => setFollow(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}><MaterialCommunityIcons name={follow ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={23} color={t.accent} /><Text style={{ color: t.text, flex: 1, lineHeight: 21 }}>Follow garden location and sensor setup</Text></Pressable>}
    </View>}
  </View>}</ActionDialog>;
}
