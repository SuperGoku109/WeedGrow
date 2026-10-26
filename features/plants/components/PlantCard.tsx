import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlantImage } from '@/ui/PlantImage';
import type { Plant } from '@/firestoreModels';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { gardenThemes } from '@/design-system/tokens/garden';

export interface PlantCardProps {
  plant: Plant & { id: string };
  onAddLog?: (type?: string) => void;
  wateredToday?: boolean;
  waterLoading?: boolean;
  waterDisabled?: boolean;
  onPress?: () => void;
}
const colors = gardenThemes.grove;
/** Detail navigation and quick care are sibling targets, avoiding nested actions. */
export function PlantCard({ plant, onAddLog, wateredToday = false, waterLoading = false, waterDisabled = false, onPress }: PlantCardProps) {
  const router = useRouter();
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => setImageFailed(false), [uri]);
  const status = waterLoading ? 'Saving…' : wateredToday ? 'Watered' : waterDisabled ? 'Checking…' : 'Water';
  return <View style={s.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${plant.name}`} onPress={onPress ?? (() => router.push({ pathname: '/plant/[id]', params: { id: plant.id, returnToPlants: '1' } }))} style={({ pressed }) => [s.details, pressed && { opacity: 0.78 }]}>
      {uri && !imageFailed ? <PlantImage source={{ uri }} onError={() => setImageFailed(true)} style={s.image} /> : <View style={[s.image, s.placeholder]}><MaterialCommunityIcons name="sprout" size={28} color={colors.accent} /></View>}
      <View style={s.copy}><Text style={s.name} numberOfLines={2}>{plant.name}</Text><Text style={s.meta} numberOfLines={2}>{plant.environment || 'Indoor'}{plant.strain ? ` · ${plant.strain}` : ''}</Text><Text style={s.stage}>{plant.growthStage || plant.status || 'Growing'}</Text></View>
    </Pressable>
    {!!onAddLog && <Pressable accessibilityRole="button" accessibilityLabel={`${plant.name}: ${waterDisabled ? 'Checking watering history' : wateredToday ? 'Watering recorded today' : waterLoading ? 'Saving watering' : 'Log watering'}`} accessibilityState={{ disabled: wateredToday || waterLoading || waterDisabled, busy: waterLoading }} disabled={wateredToday || waterLoading || waterDisabled} onPress={() => onAddLog('watering')} style={({ pressed }) => [s.water, wateredToday && { backgroundColor: colors.elevated }, pressed && { opacity: 0.75 }]}>
      {waterLoading ? <ActivityIndicator size={22} color={colors.water} /> : <MaterialCommunityIcons name={wateredToday ? 'check-circle-outline' : 'water-outline'} size={24} color={wateredToday ? colors.accent : colors.water} />}
      <Text style={s.waterLabel}>{status}</Text>
    </Pressable>}
  </View>;
}
const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12, padding: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#40523a', gap: 6 },
  details: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 88 },
  image: { width: 56, height: 64, borderRadius: 12, backgroundColor: colors.elevated },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19, textTransform: 'capitalize' },
  stage: { color: colors.accent, fontSize: 13, lineHeight: 19, textTransform: 'capitalize' },
  water: { minWidth: 64, minHeight: 64, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, padding: 8, backgroundColor: colors.background },
  waterLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
export default PlantCard;
