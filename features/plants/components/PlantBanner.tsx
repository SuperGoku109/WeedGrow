import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { Plant } from '@/firestoreModels';
import { usePhotoUri } from '@/ui/PlantImage';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import type { PlantTheme } from './plantDetailTheme';

const stageIcons = { germination: 'seed-outline', seedling: 'sprout', vegetative: 'leaf', flowering: 'flower-outline', clone: 'content-cut' } as const;
const environmentIcons = { outdoor: 'white-balance-sunny', indoor: 'home-outline', greenhouse: 'greenhouse' } as const;
function BotanicalCover({ theme }: { theme: PlantTheme }) {
  return <Svg width="96" height="112" viewBox="0 0 96 112" aria-hidden={true}>
    <Circle cx="48" cy="48" r="35" fill={theme.heroText} opacity={0.05} />
    <Ellipse cx="48" cy="94" rx="22" ry="3" fill={theme.heroText} opacity={0.12} />
    <Path d="M47 81Q42 56 51 25" fill="none" stroke={theme.heroText} strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M46 65Q22 67 20 44Q41 42 46 65M48 49Q69 52 77 29Q55 28 48 49M51 32Q35 25 47 11Q61 22 51 32" fill={theme.heroText} opacity={0.85} />
    <Path d="M31 80H64L59 95H36Z" fill={theme.heroText} opacity={0.35} />
  </Svg>;
}

/** The cover and identity scroll together; the connected section rail below
 * stays sticky. No text overlays user photos, so both themes stay readable. */
export default function PlantBanner({ plant, theme: t, onEdit, onCover }: { plant: Plant; theme: PlantTheme; onEdit(): void; onCover(): void }) {
  const { width } = useWindowDimensions();
  // Long names get the full phone width instead of becoming a tall column
  // squeezed between the cover and the edge of the banner.
  const fullWidthName = width < 600 && (plant.name.trim().length > 24 || plant.name.split(/\s+/).some(word => word.length > 18));
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const photo = usePhotoUri(uri);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [uri]);
  const stage = plant.growthStage || 'seedling';
  const status = plant.status || 'active';
  const environment = plant.environment || 'outdoor';
  const place = plant.locationNickname?.trim() || (plant.plantedIn === 'pot' ? 'Potted plant' : plant.plantedIn === 'ground' ? 'In the ground' : '');
  return <View style={[s.banner, { backgroundColor: t.surface, borderColor: t.border }]}>
    {fullWidthName && <Text accessibilityRole="header" style={[s.name, s.fullName, { color: t.text }]}>{plant.name}</Text>}
    <View style={s.identity}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change plant cover photo" onPress={onCover} style={[s.cover, { backgroundColor: t.hero }]}>
        {photo.uri && !broken && !photo.failed ? <Image accessibilityLabel={`${plant.name} cover photo`} source={{ uri: photo.uri }} resizeMode="cover" onError={() => setBroken(true)} style={s.coverImage} /> : <View accessibilityLabel={uri ? 'Plant cover unavailable' : 'Botanical plant illustration'}><BotanicalCover theme={t} /></View>}
        {photo.stored && !photo.uri && !photo.failed && <View style={s.photoLoading}><ActivityIndicator size="small" color={t.heroText} accessibilityLabel="Loading plant cover" /></View>}
      </Pressable>
      <View style={s.copy}>
        {!fullWidthName && <Text accessibilityRole="header" style={[s.name, { color: t.text }]}>{plant.name}</Text>}
        {!!plant.strain?.trim() && <Text style={[s.strain, { color: t.muted }]}>{plant.strain}</Text>}
        <View style={s.badges}>
          <View accessibilityLabel={`Growth stage: ${stage}`} style={[s.stage, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name={stageIcons[stage]} size={16} color={t.accent} aria-hidden={true} /><Text style={[s.badgeText, { color: t.accent }]}>{stage}</Text></View>
          <View accessibilityLabel={`Plant status: ${status}`} style={[s.status, { borderColor: t.border }]}><View style={[s.statusDot, { backgroundColor: status === 'active' ? t.accent : t.muted }]} /><Text style={[s.badgeText, { color: t.text }]}>{status}</Text></View>
        </View>
      </View>
    </View>
    <View style={[s.contextRow, { borderTopColor: t.border }]}>
      <View style={s.context}><MaterialCommunityIcons name={environmentIcons[environment]} size={18} color={t.muted} aria-hidden={true} /><View style={{ flex: 1, minWidth: 0 }}><Text style={[s.environment, { color: t.muted }]}>{environment}</Text>{!!place && <Text style={[s.place, { color: t.text }]}>{place}</Text>}</View></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit plant details" onPress={onEdit} style={({ pressed }) => [s.edit, { borderColor: t.border, backgroundColor: pressed ? t.elevated : 'transparent' }]}><MaterialCommunityIcons name="pencil-outline" size={17} color={t.accent} aria-hidden={true} /><Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>Edit plant</Text></Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  banner: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 64, height: 74, flexShrink: 0, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverImage: { width: '100%', height: '100%' },
  photoLoading: { position: 'absolute', bottom: 7, right: 7 },
  copy: { flex: 1, minWidth: 0, gap: 7 },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  fullName: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5, marginBottom: 14 },
  strain: { fontSize: 14, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  stage: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  status: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 6, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 13, lineHeight: 18, fontWeight: '500', textTransform: 'capitalize', flexShrink: 1 },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 8, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth },
  context: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  environment: { fontSize: 12, lineHeight: 18, textTransform: 'capitalize' },
  place: { fontSize: 13, lineHeight: 19 },
  edit: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, borderRadius: 12 },
});
