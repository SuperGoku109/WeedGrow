// GroupCard.tsx
// This component displays a card summarizing a plant group with a distinct "collection" design.
// It uses a larger overlapping avatar cluster and a clean content layout to reinforce the group identity.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/ui/ThemedText';
import type { Group, Plant } from '@/firestoreModels';
import { WeedGrowEnvBadge } from '@/ui/WeedGrowEnvBadge';
import { waterAllPlantsInGroup } from '@/features/groups/api/groupApi';
import { useGroupWeather } from '@/features/groups/hooks/useGroupWeather';
import { ThemedView } from '@/ui/ThemedView';
import { usePlantsWateredToday } from '@/features/plants/hooks/usePlantsWateredToday';
import { GrowReveal } from '@/ui/GrowMotion';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';

export interface GroupCardProps {
  group: Group & { id: string };
  plants?: (Plant & { id: string })[];
  weatherData?: {
    temperature?: number;
    humidity?: number;
  };
  /** Optional label like "2 days ago" */
  lastWatered?: string;
  onEdit?: () => void;
}

const AVATAR_SIZE = 44;
const AVATAR_BORDER = 2;
const AVATAR_OVERLAP = 8; // reduced overlap for a softer stack

const GroupCard = React.memo(function GroupCard({
  group,
  plants: _plants = [],
  weatherData: _weatherData,
  lastWatered,
  onEdit,
}: GroupCardProps) {
  const router = useRouter();

  // Determine which location to use for weather: selected plant > group location > first plant with a location
  const weatherLatLng = useMemo(() => {
    const sourceId = group.weatherSourcePlantId;
    if (sourceId) {
      const p = _plants.find(pl => pl.id === sourceId);
      if (p?.location) return { lat: p.location.lat, lng: p.location.lng };
    }
    if (group.location && typeof group.location.lat === 'number' && typeof group.location.lng === 'number') {
      return { lat: group.location.lat, lng: group.location.lng };
    }
    const firstWithLoc = _plants.find(pl => pl.location);
    if (firstWithLoc?.location) return { lat: firstWithLoc.location.lat, lng: firstWithLoc.location.lng };
    return undefined;
  }, [group.weatherSourcePlantId, group.location, _plants]);

  const { weather: groupWeather, loading: weatherLoading } = useGroupWeather(weatherLatLng?.lat, weatherLatLng?.lng);

  // Avatar data (bigger, emphasize group). Show up to 5, then +N badge.
  const maxAvatars = 5;
  const avatars = useMemo(() => _plants.slice(0, maxAvatars), [_plants]);
  const moreCount = Math.max(0, _plants.length - maxAvatars);

  const handleLongPress = useCallback(() => {
    if (onEdit) onEdit();
  }, [onEdit]);

  const handlePress = useCallback(() => {
    router.push({ pathname: '/group/[id]', params: { id: group.id } });
  }, [router, group.id]);

  const [watering, setWatering] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  // Spinner animation for water action
  const loadingAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (watering) {
      loadingAnim.setValue(0);
      anim = Animated.loop(
        Animated.timing(loadingAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      );
      anim.start();
    } else {
      loadingAnim.stopAnimation && loadingAnim.stopAnimation();
      loadingAnim.setValue(0);
    }
    return () => {
      anim && anim.stop();
    };
  }, [watering, loadingAnim]);

  // Optimistic watered flag
  const plantIds = useMemo(() => {
    if (Array.isArray(group.plantIds) && group.plantIds.length > 0) return group.plantIds;
    return _plants.map(p => p.id);
  }, [_plants, group.plantIds]);
  const { wateredMap, loading: waterStatusLoading, markManyWatered } = usePlantsWateredToday(plantIds);
  const [justWateredToday, setJustWateredToday] = useState(false);

  const handleWaterAll = useCallback(async () => {
    setWatering(true);
    try {
      await waterAllPlantsInGroup(group.id, 'demoUser'); // TODO: replace with real user ID
      setSnackMessage('All plants watered!');
      setJustWateredToday(true);
      markManyWatered(plantIds);
    } catch {
      setSnackMessage('Failed to water plants.');
    } finally {
      setSnackVisible(true);
      setWatering(false);
    }
  }, [group.id, markManyWatered, plantIds]);

  const confirmWaterAll = useCallback(() => {
    const count = plantIds.length;
    Alert.alert(
      'Water all plants',
      `Water all ${count} plants in ${group.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Water', onPress: handleWaterAll },
      ]
    );
  }, [group.name, handleWaterAll, plantIds.length]);

  // Utility to get local date string (YYYY-MM-DD)
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Determine watered status (use hook, prop, or optimistic)
  const allWatered = useMemo(() => {
    if (!plantIds.length) return false;
    return plantIds.every(id => wateredMap[id]);
  }, [plantIds, wateredMap]);

  const isWatered = useMemo(() => {
    let finalFlag = false;
    if (lastWatered) {
      const todayStr = getLocalDateString();
      finalFlag = lastWatered.startsWith(todayStr) || lastWatered.toLowerCase() === 'today';
    }
    if (justWateredToday) return true;
    return allWatered || finalFlag;
  }, [allWatered, justWateredToday, lastWatered]);

  // Weather display values with optional prop fallback
  const displayTemp = useMemo(() => {
    const t = groupWeather?.temperature ?? _weatherData?.temperature;
    return typeof t === 'number' ? Math.round(t) : undefined;
  }, [groupWeather?.temperature, _weatherData?.temperature]);

  return (
    <>
      <TouchableOpacity onPress={handlePress} onLongPress={handleLongPress} activeOpacity={0.92}>
        <GrowReveal delay={180}>
          <ThemedView style={styles.card}>
            {/* Header: Env + Name + CTA */}
            <WeedGrowEnvBadge environment={group.environment} size={14} style={{ alignSelf: "flex-start", marginBottom: 10 }} />
            <View style={styles.topRow}>
              <ThemedText style={styles.groupName} numberOfLines={1}>{group.name}</ThemedText>
              <TouchableOpacity
                onPress={confirmWaterAll}
                disabled={watering || isWatered || waterStatusLoading}
                style={[styles.waterButtonPrimary, (watering || isWatered) && styles.waterButtonDisabled]}
                accessibilityLabel="Water all plants in group"
              >
                {watering ? (
                  <Animated.View style={{ transform: [{ rotate: loadingAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                    <MaterialCommunityIcons name="loading" size={18} color="#fff" />
                  </Animated.View>
                ) : (
                  <>
                    <MaterialCommunityIcons name="water" size={18} color="#fff" />
                    <ThemedText style={styles.waterButtonText}>{isWatered ? 'Watered' : 'Water all'}</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Avatar cluster crest */}
            <View style={styles.clusterWrapper}>
              {/* removed light ring */}
              {/* <View style={styles.clusterRing} /> */}
              <View style={styles.avatarsRow}>
                {avatars.map((p, idx) => {
                  const imageUri = getRenderablePlantImageUri(p.imageUri);
                  const style = [
                    styles.avatar,
                    idx > 0 && { marginLeft: -AVATAR_OVERLAP },
                  ];
                  return imageUri ? (
                    <Image key={p.id} source={{ uri: imageUri }} style={style as unknown as any} />
                  ) : (
                    <View key={p.id} style={[styles.avatarPlaceholder, idx > 0 && { marginLeft: -AVATAR_OVERLAP }]}><MaterialCommunityIcons name="sprout" size={24} color="#c8e78b" /></View>
                  );
                })}
                {moreCount > 0 && (
                  <View style={[styles.moreCircle, avatars.length > 0 && { marginLeft: -AVATAR_OVERLAP }]}>
                    <ThemedText style={styles.moreText}>+{moreCount}</ThemedText>
                  </View>
                )}
              </View>
            </View>

            <ThemedText style={{ color: "#adbea4", fontSize: 11, marginTop: 2 }}>{_plants.length} plants in this space · Tap to explore</ThemedText>
            {/* Weather summary line (condensed, single-row) */}
            {group.environment === 'outdoor' && (
              <View style={styles.weatherLine}>
                <View style={styles.segment}>
                  <MaterialCommunityIcons name="thermometer" size={12} color="#fff" />
                  <ThemedText style={styles.segmentText}>
                    {weatherLoading ? '—°' : `${displayTemp ?? '—'}°`}
                  </ThemedText>
                  <ThemedText style={styles.segmentSubtext}>
                    {groupWeather?.dayMax != null && groupWeather?.dayMin != null ? `(${groupWeather.dayMax}°/${groupWeather.dayMin}°)` : ''}
                  </ThemedText>
                </View>
                <ThemedText style={styles.separator}>•</ThemedText>
                <View style={styles.segment}>
                  <MaterialCommunityIcons name="weather-rainy" size={12} color="#fff" />
                  <ThemedText style={styles.segmentText}>{groupWeather?.dailyRainMm != null ? `${groupWeather.dailyRainMm}mm` : '0mm'}</ThemedText>
                </View>
                <ThemedText style={styles.separator}>•</ThemedText>
                <View style={styles.segment}>
                  <MaterialCommunityIcons name="water-percent" size={12} color="#fff" />
                  <ThemedText style={styles.segmentText}>{groupWeather?.humidity != null ? `${groupWeather.humidity}%` : '—%'}</ThemedText>
                </View>
              </View>
            )}

            {/* Last watered info */}
            {lastWatered && (
              <ThemedText style={styles.lastWatered}>Last watered: {lastWatered}</ThemedText>
            )}
          </ThemedView>
        </GrowReveal>
      </TouchableOpacity>

      <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={3000}>
        {snackMessage}
      </Snackbar>
    </>
  );
});

export default GroupCard;

const styles = StyleSheet.create({
  card: {
    marginBottom: 2,
    borderRadius: 24,
    backgroundColor: "#26382a",
    overflow: 'hidden',
    padding: 14,
    minHeight: 160,
    // backgroundColor removed to use ThemedView background
    borderWidth: 1,
    borderColor: '#41523a',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 1,
    marginRight: 8,
  },
  waterButtonPrimary: {
    marginLeft: 'auto',
    backgroundColor: '#3e6357',
    borderRadius: 18,
    paddingHorizontal: 10,
    height: 34,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  waterButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  waterButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  clusterWrapper: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'flex-start', // moved from center to left
    justifyContent: 'center',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // left align avatars
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: AVATAR_BORDER,
    borderColor: '#92aa70',
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#3c5135',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: AVATAR_BORDER,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  moreCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: AVATAR_BORDER,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  // Reuse chip base for weather items
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeInfo: {
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderColor: 'rgba(59,130,246,0.35)'
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 144, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(30, 144, 255, 0.35)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  lastWatered: {
    marginTop: 8,
    color: '#fff',
    fontSize: 12,
    opacity: 0.85,
  },
  // New compact weather styles
  weatherLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    justifyContent: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentSubtext: {
    color: '#fff',
    opacity: 0.8,
    fontSize: 12,
    marginLeft: 2,
  },
  separator: {
    color: '#fff',
    opacity: 0.6,
    marginHorizontal: 2,
  },
});
