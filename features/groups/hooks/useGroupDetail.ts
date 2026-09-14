/**
 * Hook for managing group details screen state and operations
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Plant } from '@/firestoreModels';
import { deleteGroup, getGroupById, GroupWithId } from '../api/groupApi';
import logger from '@/lib/logger';

export type PlantWithId = Plant & { id: string };

/**
 * Hook that manages the state and operations for the group detail screen
 * @param groupId - ID of the group to display
 * @returns Object containing group data, plants, loading state, and actions
 */
export function useGroupDetail(groupId?: string) {
  // State
  const [group, setGroup] = useState<GroupWithId | null>(null);
  const [plants, setPlants] = useState<PlantWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const router = useRouter();

  /**
   * Fetches the group and associated plant data
   */
  const fetchGroupData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Attempt to get group data first
      const groupData = await getGroupById(String(groupId));
      
      if (!groupData) {
        setGroup(null);
        setPlants([]);
        return;
      }
      
      setGroup(groupData);

      // If group has plants, fetch their data
      if (groupData.plantIds?.length) {
        const plantSnaps = await Promise.all(
          groupData.plantIds.map((pid: string) => getDoc(doc(db, 'plants', pid)))
        );
        
        const plantsData = plantSnaps
          .filter((s) => s.exists())
          .map((s) => ({ id: s.id, ...(s.data() as Plant) }));
          
        setPlants(plantsData);
      } else {
        setPlants([]);
      }
    } catch (error) {
      logger.error('Error fetching group details:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Fetch group data initially and when the groupId changes
  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  // Derived stats
  const avgAgeDays = useMemo(() => {
    if (!plants.length) return null;
    const ages = plants.map((p) => (p.ageDays ?? 0)).filter((v) => typeof v === 'number');
    if (!ages.length) return null;
    return ages.reduce((a, b) => a + b, 0) / ages.length;
  }, [plants]);

  const needsWaterCount = useMemo(() => {
    // Heuristic: count plants with waterLevel <= 0.25
    return plants.reduce((acc, p) => acc + ((p.waterLevel ?? 1) <= 0.25 ? 1 : 0), 0);
  }, [plants]);

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
    fetchGroupData();
  }, [fetchGroupData]);

  return {
    group,
    plants,
    loading,
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
    needsWaterCount,
  };
}
