import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Plant } from '@/firestoreModels';
import { useAppTheme } from '@/hooks/useAppTheme';
import { GrowPress } from '@/ui/GrowMotion';
import { PlantImage } from '@/ui/PlantImage';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { growthPhaseProgress } from '@/lib/plants/growthPhase';
import { growthStageColor, guideStage } from '../growthStagePresentation';
import { plantCardAgeLabel, plantCardMeta, plantCardStageLabel } from '../plantListPresentation';

export default function PlantGridCard({ plant, onPress, onWater, wateredToday, waterDisabled }: {
  plant: Plant & { id: string }; onPress(): void; onWater?: () => void; wateredToday: boolean; waterDisabled: boolean;
}) {
  const t = useAppTheme();
  const progress = growthPhaseProgress(plant);
  const color = growthStageColor(progress.phase, t.background);
  const stage = guideStage(progress.phase);
  const progressPercent = progress.fraction == null ? 4 : Math.max(4, Math.round(progress.fraction * 100));
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
    <View pointerEvents="none" style={s.decoration}><MaterialCommunityIcons name="leaf" size={84} color={t.accent} style={{ opacity: .07 }} /></View>
    <GrowPress accessibilityRole="button" accessibilityLabel={`Open ${plant.name}`} onPress={onPress} style={s.details}>
      <View style={[s.photo, { backgroundColor: t.elevated, borderColor: `${color}80` }]}>
        {uri && !failed ? <PlantImage accessibilityLabel={`${plant.name} photo`} source={{ uri }} resizeMode="cover" onError={() => setFailed(true)} style={StyleSheet.absoluteFillObject} /> : <MaterialCommunityIcons name="sprout" size={42} color={color} />}
      </View>
      <Text numberOfLines={2} style={[s.name, { color: t.text }]}>{plant.name}</Text>
      <Text numberOfLines={1} style={[s.meta, { color: t.muted }]}>{plantCardMeta(plant, false)}</Text>
      <View style={s.facts}>
        <View style={[s.chip, { backgroundColor: `${color}20` }]}><MaterialCommunityIcons name={stage.icon} size={12} color={color} accessible={false} /><Text numberOfLines={1} ellipsizeMode="tail" style={[s.stage, { color }]}>{plantCardStageLabel(plant)}</Text></View>
        <Text numberOfLines={1} style={[s.age, { color: t.muted }]}>{plantCardAgeLabel(plant)}</Text>
      </View>
    </GrowPress>
    <View accessibilityRole="progressbar" accessibilityLabel={progress.fraction == null ? 'Phase progress not recorded' : `${stage.title} progress${progress.estimated ? ', estimated' : ''}`} accessibilityValue={progress.fraction == null ? { text: 'Not recorded' } : { min: 0, max: 100, now: Math.round(progress.fraction * 100) }} style={[s.track, { backgroundColor: t.elevated }]}>
      <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
    {onWater && <GrowPress accessibilityRole="button" accessibilityLabel={`${plant.name}: ${wateredToday ? 'Watering recorded today' : waterDisabled ? 'Checking watering history' : 'Log watering'}`} disabled={wateredToday || waterDisabled} onPress={onWater} style={[s.water, { backgroundColor: wateredToday ? t.elevated : t.accent, opacity: waterDisabled ? .55 : 1 }]}>
      <MaterialCommunityIcons name={wateredToday ? 'check-circle-outline' : 'water-outline'} size={16} color={wateredToday ? t.accent : t.onAccent} accessible={false} /><Text style={{ color: wateredToday ? t.accent : t.onAccent, fontSize: 12, fontWeight: '600' }}>{wateredToday ? 'Watered' : 'Water'}</Text>
    </GrowPress>}
  </View>;
}
const s = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 18, overflow: 'hidden', padding: 10, gap: 8 },
  decoration: { position: 'absolute', top: -14, left: -24, transform: [{ rotate: '-25deg' }] },
  details: { alignItems: 'stretch', gap: 4, flex: 1 },
  photo: { width: '100%', aspectRatio: 1.3, borderRadius: 13, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, lineHeight: 20, fontWeight: '700', textAlign: 'left', marginTop: 2 },
  meta: { fontSize: 11, lineHeight: 16, textAlign: 'left' },
  facts: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: 'center', gap: 4, marginTop: 2, width: '100%' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3, flexShrink: 1, minWidth: 0 },
  stage: { fontSize: 9, lineHeight: 13, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  age: { fontSize: 10, lineHeight: 15, flexShrink: 0 },
  track: { height: 4, borderRadius: 3, overflow: 'hidden' },
  water: { minHeight: 36, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
