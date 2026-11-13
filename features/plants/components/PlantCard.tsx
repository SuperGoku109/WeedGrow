import { useAppTheme } from '@/hooks/useAppTheme';
import { OverflowMenuButton, type MenuAnchor } from '@/ui/AnchoredActionMenu';
import React from 'react';
import { GrowPress, GrowConfirm } from '@/ui/GrowMotion';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlantImage } from '@/ui/PlantImage';
import type { Plant } from '@/firestoreModels';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { gardenThemes } from '@/design-system/tokens/garden';
import { plantCardMeta, plantCardStage } from '../plantListPresentation';

export interface PlantCardProps {
  plant: Plant & { id: string };
  onAddLog?: (type?: string) => void;
  wateredToday?: boolean;
  waterLoading?: boolean;
  waterDisabled?: boolean;
  onPress?: () => void;
  onMore?: (anchor: MenuAnchor) => void;
  moreOpen?: boolean;
  showEnvironment?: boolean;
  moreLabel?: string;
}
/** Detail navigation and quick care are sibling targets, avoiding nested actions. */
export function PlantCard({ plant, onAddLog, wateredToday = false, waterLoading = false, waterDisabled = false, onPress, onMore, showEnvironment = true, moreLabel, moreOpen }: PlantCardProps) {
  const colors = useAppTheme();
  const s = makeStyles(colors);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [photoSize, setPhotoSize] = React.useState(() => Math.min(width, 760) - 36 < 310 ? 64 : 72);
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => setImageFailed(false), [uri]);
  return <View onLayout={event => setPhotoSize(event.nativeEvent.layout.width < 310 ? 64 : 72)} style={s.card}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`Open ${plant.name}`} onPress={onPress ?? (() => router.push({ pathname: '/plant/[id]', params: { id: plant.id, returnToPlants: '1' } }))} style={({ pressed }) => [s.details, { minHeight: Math.max(photoSize + 16, onMore && onAddLog ? 100 : 0), paddingLeft: photoSize + 22, paddingRight: onAddLog || onMore ? 68 : 12 }, pressed && { opacity: 0.82 }]}>
      <View style={[s.photo, { width: photoSize, height: photoSize, marginTop: -photoSize / 2 }]}>
        {uri && !imageFailed ? <PlantImage accessibilityLabel={`${plant.name} photo`} source={{ uri }} resizeMode="cover" onError={() => setImageFailed(true)} style={StyleSheet.absoluteFillObject} /> : <View style={s.placeholder}><MaterialCommunityIcons name="sprout" size={42} color={colors.accent} /></View>}
      </View>
      <Text style={s.name} numberOfLines={2}>{plant.name}</Text>
      <Text style={s.meta} numberOfLines={2}>{plantCardMeta(plant, showEnvironment)}</Text>
      <Text accessibilityLabel={plantCardStage(plant, false)} style={s.stage} numberOfLines={2}>{plantCardStage(plant)}</Text>
    </GrowPress>
    {!!onAddLog && <GrowPress containerStyle={[s.water, onMore && { top: undefined, marginTop: 0, bottom: 8 }]} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${plant.name}: ${waterDisabled ? 'Checking watering history' : wateredToday ? 'Watering recorded today' : waterLoading ? 'Saving watering' : 'Log watering'}`} accessibilityState={{ disabled: wateredToday || waterLoading || waterDisabled, busy: waterLoading }} disabled={wateredToday || waterLoading || waterDisabled} onPress={() => onAddLog('watering')} style={({ pressed }) => [{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, wateredToday && { backgroundColor: colors.elevated }, pressed && { opacity: 0.75 }]}>
      <GrowConfirm confirmed={wateredToday}>{waterLoading ? <ActivityIndicator size={18} color={colors.water} /> : <MaterialCommunityIcons name={wateredToday ? 'check-circle-outline' : 'water-outline'} size={18} color={wateredToday ? colors.accent : colors.water} />}</GrowConfirm>
    </GrowPress>}
    {!!onMore && <View style={s.more}><OverflowMenuButton label={moreLabel || `More options for ${plant.name}`} onOpen={onMore} expanded={moreOpen} /></View>}
  </View>;
}

const makeStyles = (colors: typeof gardenThemes.grove) => StyleSheet.create({
  card: { marginBottom: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#40523a', overflow: 'hidden' },
  details: { paddingVertical: 8, justifyContent: 'center', gap: 4 },
  photo: { position: 'absolute', left: 10, top: '50%', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.elevated },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  stage: { color: colors.accent, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  water: { position: 'absolute', right: 10, top: '50%', marginTop: -20, height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.background },
  more: { position: 'absolute', right: 6, top: 6 },
});
export default PlantCard;
