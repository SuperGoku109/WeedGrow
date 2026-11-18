import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Plant } from '@/firestoreModels';
import { useAppTheme } from '@/hooks/useAppTheme';
import { GrowPress } from '@/ui/GrowMotion';
import { usePlantImageTransition } from '@/ui/PlantImageTransition';
import { PlantImage, usePhotoUri } from '@/ui/PlantImage';
import PlantPhotoHero from '@/ui/PlantPhotoHero';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { growthPhaseProgress } from '@/lib/plants/growthPhase';
import { growthStageColor, guideStage } from '../growthStagePresentation';
import { plantCardAgeLabel, plantCardMeta, plantCardStageLabel } from '../plantListPresentation';

export default function PlantGridCard({ plant, onPress, wateredToday, waterStatus, careAlertCount = 0, selecting = false, selected = false, onSelect, onStartSelection }: {
  plant: Plant & { id: string }; onPress(): void; wateredToday: boolean;
  waterStatus?: 'check' | 'water' | 'reminder'; careAlertCount?: number;
  selecting?: boolean; selected?: boolean; onSelect?(): void; onStartSelection?(): void;
}) {
  const t = useAppTheme();
  const transition = usePlantImageTransition();
  const imageFrame = React.useRef<View>(null);
  const imageLoaded = React.useRef(false);
  const progress = growthPhaseProgress(plant);
  const color = growthStageColor(progress.phase, t.background);
  const stage = guideStage(progress.phase);
  const progressPercent = progress.fraction == null ? null : Math.round(progress.fraction * 100);
  const careStatus = wateredToday ? 'watered' : waterStatus;
  const wateringLabels = {
    watered: { label: 'Watered today', icon: 'check-circle-outline', color: t.muted },
    water: { label: 'Watering suggested', icon: 'water-outline', color: t.warm },
    reminder: { label: 'Watering reminder', icon: 'bell-outline', color: t.warm },
    check: { label: 'Check', icon: 'water-outline', color: t.warm },
  } as const;
  const waterPresentation = careStatus ? wateringLabels[careStatus] : undefined;
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const photo = usePhotoUri(uri);
  const longPressed = React.useRef(false);
  const longPressReset = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startSelection = () => {
    if (selecting || !onStartSelection) return;
    longPressed.current = true;
    onStartSelection();
  };
  const releaseCard = () => {
    if (!longPressed.current) return;
    if (longPressReset.current) clearTimeout(longPressReset.current);
    longPressReset.current = setTimeout(() => { longPressed.current = false; longPressReset.current = null; }, 100);
  };
  const open = () => {
    if (Platform.OS !== 'web' && Platform.OS !== 'android') { onPress(); return; }
    if (transition.active) return;
    const previewUri = photo.uri;
    if (!previewUri || !imageLoaded.current || !imageFrame.current || failed) { onPress(); return; }
    imageFrame.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        const frame = { x, y, width, height };
        if (Platform.OS === 'android') {
          transition.start(plant.id, previewUri, frame, onPress);
          return;
        }
        transition.start(plant.id, previewUri, frame);
      }
      onPress();
    });
  };
  const activateCard = () => {
    if (longPressed.current) { longPressed.current = false; if (longPressReset.current) clearTimeout(longPressReset.current); return; }
    if (selecting) onSelect?.(); else open();
  };
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); imageLoaded.current = false; }, [uri]);
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: selected ? t.accent : 'transparent', borderWidth: selected ? 1.5 : 0 }]}>
    <GrowPress accessibilityRole="button" accessibilityLabel={selecting ? `${selected ? 'Deselect' : 'Select'} ${plant.name}` : `Open ${plant.name}`} accessibilityHint={selecting ? 'Tap to toggle this plant selection.' : 'Long press to select plants for batch activity.'} accessibilityState={selecting ? { selected } : undefined} onPress={activateCard} onLongPress={startSelection} onPressOut={releaseCard} delayLongPress={350} style={s.details}>
      <View ref={imageFrame} collapsable={false} style={[s.photo, { backgroundColor: t.elevated }]}>
        <PlantPhotoHero id={`plant-photo-${plant.id}`} style={StyleSheet.absoluteFillObject}>
          {uri && !failed ? <PlantImage accessibilityLabel={`${plant.name} photo`} source={{ uri }} resizeMode="cover" fadeDuration={Platform.OS === 'android' ? 0 : undefined} onLoad={() => { imageLoaded.current = true; }} onError={() => setFailed(true)} style={StyleSheet.absoluteFillObject} /> : <MaterialCommunityIcons name="sprout" size={42} color={color} />}
        </PlantPhotoHero>
      </View>
      <View style={s.identity}>
        <Text numberOfLines={2} style={[s.name, { color: t.text }]}>{plant.name}</Text>
        <Text numberOfLines={1} style={[s.meta, { color: t.muted }]}>{plantCardMeta(plant, false)}</Text>
        <View style={s.facts}>
          <View style={[s.chip, { backgroundColor: `${color}20` }]}><MaterialCommunityIcons name={stage.icon} size={12} color={color} accessible={false} /><Text numberOfLines={1} ellipsizeMode="tail" style={[s.stage, { color }]}>{plantCardStageLabel(plant)}</Text></View>
          <Text numberOfLines={1} style={[s.age, { color: t.muted }]}>{plantCardAgeLabel(plant).replace(/^~/, '')}</Text>
        </View>
      </View>
      {careAlertCount > 0 && <View pointerEvents="none" accessibilityLabel={`${careAlertCount} care ${careAlertCount === 1 ? 'alert' : 'alerts'}`} style={[s.alertCount, { backgroundColor: t.danger }]}><Text style={{ color: t.onDanger, fontSize: 11, lineHeight: 18, fontWeight: '700' }}>{careAlertCount}</Text></View>}
      {selected && <View pointerEvents="none" style={[s.selectedMark, { backgroundColor: t.accent }]}><MaterialCommunityIcons name="check" size={16} color={t.onAccent} /></View>}
    </GrowPress>
    <View style={s.footer}>
      {progressPercent !== null && (
        <View accessibilityRole="progressbar" accessibilityLabel={`${stage.title} progress${progress.estimated ? ', estimated' : ''}`} accessibilityValue={{ min: 0, max: 100, now: progressPercent }} style={[s.track, { backgroundColor: t.elevated }]}>
          <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: color, borderRadius: 3 }} />
        </View>
      )}
      {plant.status === 'active' && waterPresentation && <View accessible accessibilityLabel={careStatus === 'check' ? 'Check watering needs' : waterPresentation.label} style={s.statusRow}>
        <View style={s.statusItem}><MaterialCommunityIcons name={waterPresentation.icon} size={16} color={waterPresentation.color} accessible={false} /><Text numberOfLines={1} style={[s.statusText, { color: waterPresentation.color }]}>{waterPresentation.label}</Text></View>
      </View>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, overflow: 'hidden', gap: 8 },
  identity: { paddingHorizontal: 11, gap: 4 },
  footer: { paddingHorizontal: 11, paddingBottom: 11, gap: 5 },
  details: { position: 'relative', alignItems: 'stretch', gap: 4, flex: 1 },
  selectedMark: { position: 'absolute', top: 6, left: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  alertCount: { position: 'absolute', top: 6, right: 6, minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 1.2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, lineHeight: 20, fontWeight: '700', textAlign: 'left', marginTop: 2 },
  meta: { fontSize: 11, lineHeight: 16, textAlign: 'left' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', gap: 4, marginTop: 2, width: '100%' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3, flexShrink: 1, minWidth: 0 },
  stage: { fontSize: 11, lineHeight: 15, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  age: { fontSize: 10, lineHeight: 15, flexShrink: 0 },
  track: { height: 4, borderRadius: 3, overflow: 'hidden' },
  statusRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }, statusItem: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }, statusText: { minWidth: 0, flexShrink: 1, fontSize: 10, lineHeight: 14, fontWeight: '600' },
});
