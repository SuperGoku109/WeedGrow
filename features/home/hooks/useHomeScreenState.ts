import { useState, useCallback } from 'react';
import { useGroupList } from './useGroupList';
import { useGroupListFilters } from '../../groups/hooks/useGroupListFilters';
import { useGroupPlantsMap } from '../../groups/hooks/useGroupPlantsMap';
import { useGroupListHandlers } from './useGroupListHandlers';

/**
 * Main hook for managing the home/group list screen state
 */
export const useHomeScreenState = () => {
  // Core groups data and operations
  const groupsState = useGroupList();

  const { handleWaterAll: handleWaterAllApi } = groupsState;

  // Filtering state and logic
  const {
    searchQuery,
    setSearchQuery,
    envFilter,
    setEnvFilter,
    filtersVisible,
    setFiltersVisible,
    filteredGroups,
    clearFilters,
    hasActiveFilters,
  } = useGroupListFilters(groupsState.groups);

  // Mapping of plants to groups
  const groupPlantsMap = useGroupPlantsMap(filteredGroups, groupsState.allPlants);

  // Notification state
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  // Loading and disabled state for watering operations
  const [waterLoadingMap, setWaterLoadingMap] = useState<Record<string, boolean>>({});
  const [waterDisabledMap, setWaterDisabledMap] = useState<Record<string, boolean>>({});

  // Group action handlers
  const { handleEditGroup } = useGroupListHandlers({
    handleWaterAllApi,
    setEditGroup: groupsState.setEditGroup,
    setSnackMessage,
    setSnackVisible
  });

  /**
   * Handles watering all plants in a group with loading state
   * @param groupId - ID of the group to water
   */
  const handleWaterAll = useCallback(async (groupId: string) => {
    setWaterLoadingMap((prev) => ({ ...prev, [groupId]: true }));
    setWaterDisabledMap((prev) => ({ ...prev, [groupId]: true }));
    try {
      await handleWaterAllApi(groupId);
      setSnackMessage('All plants watered successfully!');
    } catch (error: unknown) {
      console.error('Error watering group plants:', error);
      setSnackMessage(error instanceof Error ? error.message : 'Failed to water plants');
    } finally {
      setWaterLoadingMap((prev) => ({ ...prev, [groupId]: false }));
      setTimeout(() => {
        setWaterDisabledMap((prev) => ({ ...prev, [groupId]: false }));
      }, 500);
      setSnackVisible(true);
    }
  }, [handleWaterAllApi]);

  /**
   * Dismisses the notification snackbar
   */
  const dismissSnack = useCallback(() => {
    setSnackVisible(false);
  }, []);

  return {
    groups: groupsState.groups,
    loading: groupsState.loading,
    error: groupsState.error,
    allPlants: groupsState.allPlants,
    state: groupsState,
    searchQuery,
    setSearchQuery,
    envFilter,
    setEnvFilter,
    filtersVisible,
    setFiltersVisible,
    filteredGroups,
    clearFilters,
    hasActiveFilters,
    groupPlantsMap,
    snackVisible,
    setSnackVisible,
    snackMessage,
    setSnackMessage,
    dismissSnack,
    waterLoadingMap,
    waterDisabledMap,
    handleEditGroup,
    handleWaterAll,
    reloadGroups: groupsState.reloadGroups,
  };
};
