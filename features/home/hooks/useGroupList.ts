/**
 * Hook for managing the groups list state and operations
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { getUserGroups, waterAllPlantsInGroup, GroupWithId } from '@/features/groups/api/groupApi';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Plant } from '@/firestoreModels';
import { Alert } from 'react-native';
import { PlantWithId } from '../../groups/hooks/useGroupDetail';
import logger from '@/lib/logger';
import { migrateStoredPlantImageIfNeeded } from '@/lib/plants/plantImages';

// TODO: Replace with actual authentication user ID
const CURRENT_USER_ID = 'demoUser';

/**
 * Hook for managing the list of groups
 * @returns Object with groups data, loading state, and group operations
 */
export function useGroupList() {
  // State management
  const [groups, setGroups] = useState<GroupWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState<GroupWithId | null>(null);
  const [allPlants, setAllPlants] = useState<PlantWithId[]>([]);

  // Track loading for both fetches
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [plantsLoaded, setPlantsLoaded] = useState(false);

  // Optimization to prevent unnecessary re-renders
  const lastGroupsRef = useRef<string>('');

  /**
   * Fetches all groups for the current user
   */
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setGroupsLoaded(false);
    setError(null);
    try {
      const data = await getUserGroups(CURRENT_USER_ID);
      const dataHash = JSON.stringify(data);
      // Only update state if data has changed
      if (dataHash !== lastGroupsRef.current) {
        setGroups(data);
        lastGroupsRef.current = dataHash;
      }
    } catch (error: unknown) {
      logger.error('Error fetching groups', error);
      const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Failed to load groups';
      setError(message);
    } finally {
      setGroupsLoaded(true);
    }
  }, []);

  /**
   * Fetches all plants for filtering and selection
   */
  const fetchAllPlants = useCallback(async () => {
    setPlantsLoaded(false);
    try {
      const q = query(collection(db, 'plants'));
      const snap = await getDocs(q);
      const plantsData = snap.docs.map((d) => ({ 
        id: d.id, 
        ...(d.data() as Plant) 
      }));
      setAllPlants(plantsData);

      void Promise.all(
        plantsData.map(async (plant) => {
          const imageUri = await migrateStoredPlantImageIfNeeded(plant.id, plant.imageUri);
          return imageUri ? { plantId: plant.id, imageUri } : null;
        })
      ).then((results) => {
        const migrations = results.filter(
          (result): result is { plantId: string; imageUri: string } => result !== null
        );
        if (!migrations.length) return;

        setAllPlants((currentPlants) =>
          currentPlants.map((plant) => {
            const migration = migrations.find((entry) => entry.plantId === plant.id);
            return migration ? { ...plant, imageUri: migration.imageUri } : plant;
          })
        );
      });
    } catch (error) {
      logger.error('Error fetching plants:', error);
      // Non-critical error, don't show alert
    } finally {
      setPlantsLoaded(true);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    setLoading(true);
    setGroupsLoaded(false);
    setPlantsLoaded(false);
    fetchGroups();
    fetchAllPlants();
  }, [fetchGroups, fetchAllPlants]);

  // Only set loading to false when both are loaded
  useEffect(() => {
    if (groupsLoaded && plantsLoaded) {
      setLoading(false);
    }
  }, [groupsLoaded, plantsLoaded]);

  /**
   * Water all plants in a group
   * @param groupId - ID of the group containing plants to water
   */
  const handleWaterAll = useCallback(async (groupId: string) => {
    try {
      await waterAllPlantsInGroup(groupId, CURRENT_USER_ID);
      // No reload groups needed - state stays stable
      return true;
    } catch (error) {
      logger.error('Error watering group plants:', error);
      Alert.alert('Error', 'Failed to water plants');
      return false;
    }
  }, []);

  /**
   * Manually reload the groups list
   */
  const reloadGroups = useCallback(async () => {
    await fetchGroups();
  }, [fetchGroups]);

  return {
    groups,
    loading,
    error,
    handleWaterAll,
    editGroup,
    setEditGroup,
    reloadGroups,
    allPlants,
    fetchAllPlants,
  };
}
