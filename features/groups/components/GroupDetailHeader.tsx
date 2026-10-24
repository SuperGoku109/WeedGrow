import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CollectionButton, environments, ink, SpaceArtwork } from './CollectionUI';

interface GroupHeaderProps {
  name: string;
  environment: string;
  weather?: { temperature: number; rain: number; humidity: number };
  totalPlants: number;
  onMoreOptions?: (action: 'edit' | 'delete') => void;
  avgAgeDays?: number | null;
  wateredTodayCount?: number | null;
}

export default function GroupDetailHeader({ name, environment, weather, totalPlants, onMoreOptions, avgAgeDays, wateredTodayCount }: GroupHeaderProps) {
  const router = useRouter();
  const space = environments[environment as keyof typeof environments] || environments.indoor;
  return <View style={styles.wrapper}>
    <View style={styles.nav}><CollectionButton label="All groups" icon="arrow-left" onPress={() => router.replace('/')} /></View>
    <View style={[styles.card, { backgroundColor: space.backdrop }]}>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: space.color }]}>{space.label.toUpperCase()} COLLECTION</Text>
          <Text accessibilityRole="header" style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>{totalPlants} {totalPlants === 1 ? 'plant' : 'plants'} in this space</Text>
        </View>
        <SpaceArtwork environment={environment} />
      </View>
      <View style={styles.stats}>
        {typeof avgAgeDays === 'number' && <Text style={styles.stat}>Avg age {Math.round(avgAgeDays)}d</Text>}
        {typeof wateredTodayCount === 'number' && <Text style={styles.stat}>{wateredTodayCount} watered today</Text>}
        {weather && <Text style={styles.stat}>{weather.temperature}°C · {weather.humidity}% humidity · {weather.rain}% rain</Text>}
      </View>
      {onMoreOptions && <View style={styles.actions}>
        <CollectionButton label="Edit group" icon="tune-variant" onPress={() => onMoreOptions('edit')} />
        <CollectionButton label="Delete group" icon="trash-can-outline" onPress={() => onMoreOptions('delete')} />
      </View>}
    </View>
    <Text style={styles.section}>IN THIS COLLECTION</Text>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { gap: 16, paddingTop: 12 },
  nav: { flexDirection: 'row' },
  card: { borderRadius: 26, borderWidth: 1, borderColor: ink.border, padding: 22, gap: 18 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 14 },
  title: { color: ink.text, fontSize: 38, letterSpacing: -1.2, lineHeight: 43, fontWeight: '600' },
  subtitle: { color: ink.muted, fontSize: 13, marginTop: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { color: ink.muted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderTopWidth: 1, borderTopColor: ink.border, paddingTop: 18 },
  section: { fontSize: 10, color: ink.muted, letterSpacing: 2, fontWeight: '700', paddingTop: 8 },
});
