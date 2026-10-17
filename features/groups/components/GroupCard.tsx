import { PlantImage as Image } from '@/ui/PlantImage';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Group, Plant } from '@/firestoreModels';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { environments, ink, SpaceArtwork } from './CollectionUI';

export interface GroupCardProps {
  group: Group & { id: string };
  plants?: (Plant & { id: string })[];
  weatherData?: { temperature?: number; humidity?: number };
  lastWatered?: string;
  onEdit?: () => void;
}

export default React.memo(function GroupCard({ group, plants = [], onEdit }: GroupCardProps) {
  const router = useRouter();
  const environment = environments[group.environment] || environments.indoor;
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${group.name}, ${plants.length} plants`}
      onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
      style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}>
      <View style={[styles.cover, { backgroundColor: environment.backdrop }]}>
        <View style={{ flex: 1, gap: 12 }}>
          <View style={styles.environment}>
            <MaterialCommunityIcons name={environment.icon} size={14} color={environment.color} />
            <Text style={[styles.eyebrow, { color: environment.color }]}>{environment.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.subtitle}>{plants.length} {plants.length === 1 ? 'plant' : 'plants'} · One shared space</Text>
        </View>
        <SpaceArtwork environment={group.environment} />
      </View>
      <View style={styles.members}>
        <View style={styles.avatars}>
          {plants.slice(0, 4).map((plant, index) => {
            const uri = getRenderablePlantImageUri(plant.imageUri);
            return <View key={plant.id} style={[styles.avatar, { marginLeft: index ? -8 : 0 }]}>
              {uri ? <Image source={{ uri }} style={styles.image} /> : <MaterialCommunityIcons name="leaf" size={19} color={environment.color} />}
            </View>;
          })}
          {plants.length === 0 && <View style={styles.avatar}><MaterialCommunityIcons name="plus" size={18} color={ink.muted} /></View>}
          {plants.length > 4 && <View style={[styles.avatar, { marginLeft: -8 }]}><Text style={styles.extra}>+{plants.length - 4}</Text></View>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.memberNames}>{plants.length ? plants.slice(0, 3).map(p => p.name).join(', ') : 'Room for something new'}</Text>
          <Text style={styles.hint}>{plants.length ? 'View collection' : 'Add plants to this group'}</Text>
        </View>
        <MaterialCommunityIcons name="arrow-top-right" size={21} color={ink.lime} />
      </View>
    </Pressable>
    {onEdit && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${group.name}`} onPress={onEdit}
      style={({ pressed }) => [styles.edit, pressed && { backgroundColor: '#334734' }]}>
      <MaterialCommunityIcons name="tune-variant" size={16} color={ink.muted} />
      <Text style={styles.editText}>Manage group</Text>
    </Pressable>}
  </View>;
});

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, borderColor: ink.border, overflow: 'hidden', backgroundColor: ink.surface },
  cover: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 148 },
  environment: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  name: { color: ink.text, fontSize: 28, lineHeight: 33, fontWeight: '600', letterSpacing: -0.8 },
  subtitle: { color: ink.muted, fontSize: 12 },
  members: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 18 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#354734', borderWidth: 2, borderColor: ink.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  extra: { fontSize: 10, color: ink.text, fontWeight: '700' },
  memberNames: { fontSize: 12, color: ink.text, marginBottom: 4 },
  hint: { fontSize: 11, color: ink.muted },
  edit: { minHeight: 44, borderTopWidth: 1, borderTopColor: '#344633', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  editText: { fontSize: 12, color: ink.muted, fontWeight: '600' },
});
