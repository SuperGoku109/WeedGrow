import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { usePlantImageTransition } from '@/ui/PlantImageTransition';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import PlantCoverFade from '@/ui/PlantCoverFade';
import type { Plant } from '@/firestoreModels';
import { usePhotoUri } from '@/ui/PlantImage';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import PlantPhotoHero from '@/ui/PlantPhotoHero';
import { growthPhase, phaseWindow } from '@/lib/plants/growthPhase';
import { growthStageColor } from '../growthStagePresentation';
import { stageLabel } from '@/lib/plants/growthTracking';
import type { PlantTheme } from './plantDetailTheme';

const stageIcons = { deceased: 'heart-broken', unknown: 'help-circle-outline', germination: 'seed-outline', seedling: 'sprout', vegetative: 'leaf', preflower: 'flower-outline', flowering: 'flower-outline', late_flowering: 'flower-tulip', clone: 'content-cut', harvested: 'basket-outline', drying: 'weather-windy', curing: 'archive-outline', completed: 'check-circle-outline' } as const;
const environmentIcons = { outdoor: 'white-balance-sunny', indoor: 'home-outline', greenhouse: 'greenhouse' } as const;
function BotanicalCover({ theme }: { theme: PlantTheme }) {
  return <Svg width="132" height="154" viewBox="0 0 96 112" aria-hidden={true}>
    <Circle cx="48" cy="48" r="35" fill={theme.heroText} opacity={0.05} />
    <Ellipse cx="48" cy="94" rx="22" ry="3" fill={theme.heroText} opacity={0.12} />
    <Path d="M47 81Q42 56 51 25" fill="none" stroke={theme.heroText} strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M46 65Q22 67 20 44Q41 42 46 65M48 49Q69 52 77 29Q55 28 48 49M51 32Q35 25 47 11Q61 22 51 32" fill={theme.heroText} opacity={0.85} />
    <Path d="M31 80H64L59 95H36Z" fill={theme.heroText} opacity={0.35} />
  </Svg>;
}

/** Photo, identity and compact facts share the section rail's card. */
export default function PlantBanner({ plant, theme: t, onEdit }: { plant: Plant; theme: PlantTheme; onEdit(): void }) {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const transition = usePlantImageTransition();
  const cover = React.useRef<View>(null);
  const measureCover = React.useCallback(() => {
    if (!transition.active) return;
    cover.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) transition.arrive(id, { x, y, width, height });
    });
  }, [id, transition]);
  React.useLayoutEffect(measureCover, [measureCover]);
  const coverHeight = Math.min(200, Math.max(156, (width - 36) * 0.48));
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const fullPhoto = usePhotoUri(transition.active ? null : uri, true);
  const preview = usePhotoUri(uri);
  const photo = transition.active && transition.previewUri ? { ...preview, uri: transition.previewUri, failed: false } : fullPhoto.uri ? fullPhoto : preview;
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [uri]);
  const status = plant.status || 'active';
  const stage = status === 'dead' ? 'deceased' : growthPhase(plant) || 'unknown';
  const stageColor = growthStageColor(stage, t.background);
  const statusLabel = status === 'dead' ? 'Deceased' : status.charAt(0).toUpperCase() + status.slice(1);
  const environment = plant.environment || 'outdoor';
  const place = plant.locationNickname?.trim() || (plant.plantedIn === 'pot' ? 'Potted plant' : plant.plantedIn === 'ground' ? 'In the ground' : '');
  const hasPhoto = !!photo.uri && !broken && !photo.failed;
  const strain = plant.strain?.trim() || plant.strainType?.trim();
  return <View style={[s.banner, { backgroundColor: t.surface, borderColor: t.border }]}>
    <View ref={cover} onLayout={measureCover} collapsable={false} style={[s.cover, { minHeight: coverHeight, backgroundColor: t.hero }]}>
      {hasPhoto ? <PlantPhotoHero id={`plant-photo-${id}`} style={StyleSheet.absoluteFillObject}><Image accessibilityLabel={`${plant.name} cover photo`} source={{ uri: photo.uri! }} resizeMode="cover" onError={() => setBroken(true)} style={StyleSheet.absoluteFillObject} /></PlantPhotoHero> : <View style={s.botanical} accessibilityLabel={uri ? 'Plant cover unavailable' : 'Botanical plant illustration'}><BotanicalCover theme={t} /></View>}
      <PlantCoverFade surface={t.surface} />
      {status !== 'active' && status !== 'dead' && <View pointerEvents="none" accessibilityLabel={`Plant status: ${statusLabel}`} style={s.status}><View style={[s.statusDot, { backgroundColor: '#d5ddd0' }]} /><Text style={s.statusText}>{statusLabel}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${plant.name}`} onPress={onEdit} hitSlop={4} style={({ pressed }) => [s.photoAction, { opacity: pressed ? 0.7 : 1 }]}><MaterialCommunityIcons name="pencil-outline" size={19} color="#edf0e3" aria-hidden={true} /></Pressable>
      {photo.stored && !photo.uri && !photo.failed && <View pointerEvents="none" style={StyleSheet.absoluteFillObject}><ActivityIndicator style={{ flex: 1 }} size="small" color={t.heroText} accessibilityLabel="Loading plant cover" /></View>}
      <View pointerEvents="none" style={s.identity}><Text accessibilityRole="header" style={s.name}>{plant.name}</Text>{!!strain && <Text style={s.strain}>{strain}</Text>}</View>
    </View>
    <View style={s.details}>
        <View accessibilityLabel={`Growth stage: ${phaseWindow(stage)?.label || stageLabel(stage)}`} style={[s.stage, { backgroundColor: `${stageColor}20` }]}><MaterialCommunityIcons name={stageIcons[stage]} size={16} color={stageColor} aria-hidden={true} /><Text style={[s.badgeText, { color: stageColor }]}>{phaseWindow(stage)?.label || stageLabel(stage)}</Text></View>
        <View style={s.context}><MaterialCommunityIcons name={environmentIcons[environment]} size={16} color={t.muted} aria-hidden={true} /><Text style={[s.environment, { color: t.muted }]}>{environment}{place ? ` · ${place}` : ''}</Text></View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  banner: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  cover: { width: '100%', minHeight: 156, paddingTop: 58, paddingBottom: 24, paddingHorizontal: 16, alignItems: 'flex-start', justifyContent: 'flex-end' },
  botanical: { position: 'absolute', right: 24, top: 0 },
  photoAction: { position: 'absolute', right: 10, top: 10, width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center' },
  identity: { alignSelf: 'stretch', gap: 2 },
  name: { fontSize: 25, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5, color: '#f5f7ed' },
  strain: { fontSize: 13, lineHeight: 18, color: '#dde5d7', textTransform: 'capitalize' },
  details: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 6 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9 },
  status: { position: 'absolute', top: 13, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.78)' },
  statusText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: '#edf0e3', textTransform: 'capitalize' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 13, lineHeight: 18, fontWeight: '500', textTransform: 'capitalize' },
  context: { flexDirection: 'row', alignItems: 'center', gap: 5, flexGrow: 1, flexShrink: 1, flexBasis: 130 },
  environment: { flex: 1, fontSize: 13, lineHeight: 19, textTransform: 'capitalize' },
});
