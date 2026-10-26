/**
 * Hook for handling group-related actions
 */
import { useCallback } from 'react';
import { GroupWithId } from '../../groups/api/groupApi';

interface GroupListHandlersProps {
  handleWaterAllApi: (groupId: string) => Promise<boolean>;
  setEditGroup: (group: GroupWithId | null) => void;
  setSnackMessage: (message: string) => void;
  setSnackVisible: (visible: boolean) => void;
}

/**
 * Provides handlers for group list item actions
 * @param props - Properties for configuring handlers
 * @returns Object containing action handler functions
 */
export function useGroupListHandlers({
  handleWaterAllApi, 
  setEditGroup, 
  setSnackMessage, 
  setSnackVisible
}: GroupListHandlersProps) {
  /**
   * Handles watering all plants in a group
   * @param groupId - ID of the group to water
   */
  const handleWaterAll = useCallback(async (groupId: string) => {
    try {
      const success = await handleWaterAllApi(groupId);
      if (success) {
        setSnackMessage('All plants watered successfully');
      }
    } catch (error: unknown) {
      // Extract error message if available
      const errorMessage = error && typeof error === 'object' && 'message' in error 
        ? String(error.message)
        : 'Failed to water plants';
      
      setSnackMessage(errorMessage);
      console.error('Error watering plants:', error);
    } finally {
      setSnackVisible(true);
    }
  }, [handleWaterAllApi, setSnackMessage, setSnackVisible]);

  /**
   * Handles editing a group
   * @param group - Group to edit
   */
  const handleEditGroup = useCallback((group: GroupWithId) => {
    setEditGroup(group);
  }, [setEditGroup]);

  return { handleWaterAll, handleEditGroup };
}
