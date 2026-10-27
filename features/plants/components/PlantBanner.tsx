import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import type { Plant } from '@/firestoreModels';
import { usePhotoUri } from '@/ui/PlantImage';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import type { PlantTheme } from './plantDetailTheme';

const stageIcons = { germination: 'seed-outline', seedling: 'sprout', vegetative: 'leaf', flowering: 'flower-outline', clone: 'content-cut' } as const;
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

/** Full-width cover and a single identity block share the section rail's card. */
export default function PlantBanner({ plant, theme: t, onCover }: { plant: Plant; theme: PlantTheme; onCover(): void }) {
  const { width } = useWindowDimensions();
  const coverHeight = Math.min(240, Math.max(170, (width - 36) * 0.52));
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const photo = usePhotoUri(uri, true);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [uri]);
  const stage = plant.growthStage || 'seedling';
  const status = plant.status || 'active';
  const environment = plant.environment || 'outdoor';
  const place = plant.locationNickname?.trim() || (plant.plantedIn === 'pot' ? 'Potted plant' : plant.plantedIn === 'ground' ? 'In the ground' : '');
  const hasPhoto = !!photo.uri && !broken && !photo.failed;
  return <View style={[s.banner, { backgroundColor: t.surface, borderColor: t.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Change plant cover photo" onPress={onCover} style={({ pressed }) => [s.cover, { height: coverHeight, backgroundColor: t.hero, opacity: pressed ? 0.9 : 1 }]}>
      {hasPhoto ? <Image accessibilityLabel={`${plant.name} cover photo`} source={{ uri: photo.uri! }} resizeMode="cover" onError={() => setBroken(true)} style={StyleSheet.absoluteFillObject} /> : <View accessibilityLabel={uri ? 'Plant cover unavailable' : 'Botanical plant illustration'}><BotanicalCover theme={t} /></View>}
      {hasPhoto && <LinearGradient pointerEvents="none" colors={['transparent', t.surface]} style={s.fade} />}
      <View pointerEvents="none" style={[s.photoAction, { backgroundColor: t.surface }]}><MaterialCommunityIcons name="camera-outline" size={22} color={t.text} aria-hidden={true} /></View>
      {photo.stored && !photo.uri && !photo.failed && <View style={s.photoLoading}><ActivityIndicator size="small" color={t.heroText} accessibilityLabel="Loading plant cover" /></View>}
    </Pressable>
    <View style={s.identity}>
      <View style={s.titleRow}><View style={s.copy}><Text accessibilityRole="header" style={[s.name, { color: t.text }]}>{plant.name}</Text>{!!plant.strain?.trim() && <Text style={[s.strain, { color: t.muted }]}>{plant.strain}</Text>}</View></View>
      <View style={s.details}>
        <View accessibilityLabel={`Growth stage: ${stage}`} style={[s.stage, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name={stageIcons[stage]} size={16} color={t.accent} aria-hidden={true} /><Text style={[s.badgeText, { color: t.accent }]}>{stage}</Text></View>
        <View accessibilityLabel={`Plant status: ${status}`} style={s.status}><View style={[s.statusDot, { backgroundColor: status === 'active' ? t.accent : t.muted }]} /><Text style={[s.badgeText, { color: t.muted }]}>{status}</Text></View>
      </View>
      <View style={s.context}><MaterialCommunityIcons name={environmentIcons[environment]} size={17} color={t.muted} aria-hidden={true} /><Text style={[s.environment, { color: t.muted }]}>{environment}{place ? ` · ${place}` : ''}</Text></View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  banner: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  cover: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 44 },
  photoAction: { position: 'absolute', right: 12, top: 12, width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', opacity: 0.94 },
  photoLoading: { position: 'absolute', bottom: 14, right: 14 },
  identity: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 },
  strain: { fontSize: 14, lineHeight: 20 },
  details: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 13, lineHeight: 18, fontWeight: '500', textTransform: 'capitalize' },
  context: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  environment: { flex: 1, fontSize: 13, lineHeight: 19, textTransform: 'capitalize' },
});
