import { useOwnedGroups } from '@/hooks/useGardenData';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { plantDay } from '@/lib/dates/plantDay';
import { plantAgeDays } from '@/lib/plants/plantAge';
/**
 * Hook for managing group details screen state and operations
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { Plant } from '@/firestoreModels';
import { deleteGroup } from '../api/groupApi';
import logger from '@/lib/logger';

export type PlantWithId = Plant & { id: string };

/**
 * Hook that manages the state and operations for the group detail screen
 * @param groupId - ID of the group to display
 * @returns Object containing group data, plants, loading state, and actions
 */
export function useGroupDetail(groupId?: string) {
  const spaces = useOwnedGroups(); const garden = usePlantList();
  const now = useMinuteClock();
  const refreshSpaces = spaces.refresh; const refreshGarden = garden.refresh;
  const group = useMemo(() => spaces.groups.find(item => item.id === groupId) || null, [spaces.groups, groupId]);
  const plants = useMemo(() => {
    const byId = new Map(garden.plants.map(plant => [plant.id, plant]));
    return (group?.plantIds || []).flatMap(id => { const plant = byId.get(id); return plant ? [plant] : []; });
  }, [garden.plants, group]);
  const loading = spaces.loading || garden.loading;
  const error = spaces.error || garden.error;
  const [editVisible, setEditVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const router = useRouter();

  // Derived stats
  const avgAgeDays = useMemo(() => {
    if (!plants.length) return null;
    const ages = plants.map(p => plantAgeDays(p, plantDay(now, p.locationTimeZone))).filter((age): age is number => age != null);
    if (!ages.length) return null;
    return ages.reduce((a, b) => a + b, 0) / ages.length;
  }, [plants, now]);


  /**
   * Open delete confirmation
   */
  const handleDeleteGroup = useCallback(() => {
    setDeleteError('');
    setConfirmDeleteVisible(true);
  }, []);

  /**
   * Confirm deletion after user approves
   */
  const confirmDeleteGroup = useCallback(async () => {
    if (!group || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteGroup(group.id);
      setConfirmDeleteVisible(false);
      router.replace('/(tabs)');
    } catch (error) {
      logger.error('Error deleting group:', error);
      setDeleteError('Could not delete this group. Please try again.');
    } finally {
      setDeleting(false);
      deleteLock.current = false;
    }
  }, [group, router]);

  /**
   * Cancel deletion
   */
  const cancelDeleteGroup = useCallback(() => setConfirmDeleteVisible(false), []);

  // Handle back button navigation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (editVisible) {
          setEditVisible(false);
          return true; // Prevent default behavior
        }
        if (confirmDeleteVisible) {
          setConfirmDeleteVisible(false);
          return true;
        }
        router.replace('/');
        return true; // Prevent default behavior
      };
      
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [editVisible, confirmDeleteVisible, router])
  );
  /**
   * Refreshes the group data
   */
  const refreshGroup = useCallback(() => {
    refreshSpaces(); refreshGarden();
  }, [refreshSpaces, refreshGarden]);

  return {
    group,
    plants,
    loading,
    error,
    editVisible,
    setEditVisible,
    deleting,
    deleteError,
    handleDeleteGroup,
    confirmDeleteGroup,
    cancelDeleteGroup,
    confirmDeleteVisible,
    refreshGroup,
    // derived
    avgAgeDays,
  };
}
