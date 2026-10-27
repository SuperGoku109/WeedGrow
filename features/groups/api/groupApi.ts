import { saveGrowingSpace } from './membership';
import { waterGrowingSpace } from '@/lib/logs/groupWatering';
import { requireUserId } from '@/services/session';
/**
 * Group API Module
 * Handles all Firestore operations related to plant groups
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Group } from '@/firestoreModels';
import logger from '@/lib/logger';
import { validCoordinates } from '@/features/location/locationService';
import { refreshGardenWeather } from '@/lib/weather/refreshGardenWeather';

/**
 * Group type with ID field
 */
export type GroupWithId = Group & { id: string };

/**
 * Options for creating a new group
 */
export interface CreateGroupOptions {
  name: string;
  plantIds: string[];
  environment: 'outdoor' | 'indoor' | 'greenhouse';
  location?: { lat: number; lng: number } | null;
  locationLabel?: string;
  createdBy: string;
  sensorProfileId?: string;
}

/**
 * Options for updating an existing group
 */
export type UpdateGroupOptions = Partial<Omit<Group, 'createdAt' | 'createdBy'>>;

/**
 * Fetches all groups created by a specific user
 * @param userId - The user ID to fetch groups for
 * @returns Promise containing array of groups with IDs
 */
export async function getUserGroups(userId: string): Promise<GroupWithId[]> {
  try {
    if (userId !== requireUserId()) throw new Error('Sign in to your own garden.');
    const q = query(collection(db, 'groups'), where('createdBy', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Group) }));
  } catch (error) {
    logger.error('Error fetching user groups:', error);
    throw new Error('Could not load your gardens. Please try again.');
  }
}

/**
 * Creates a new plant group
 * @param options - Group creation options
 * @returns Promise with the new group ID
 */
export async function createGroup(options: CreateGroupOptions): Promise<string> {
  if (!validCoordinates(options.location)) throw new Error('Choose a location for your garden to start collecting weather.');
  const id = await saveGrowingSpace(undefined, { ...options, createdBy: requireUserId() });
  void refreshGardenWeather(id).catch(error => logger.error('Garden created; weather collection will retry on Home.', error));
  return id;
}

/**
 * Updates an existing group
 * @param groupId - ID of the group to update
 * @param updates - Object with fields to update
 */
export async function updateGroup(groupId: string, updates: UpdateGroupOptions, baseline?: Record<string, unknown>): Promise<void> {
  await saveGrowingSpace(groupId, updates, false, baseline);
}

/**
 * Deletes a group
 * @param groupId - ID of the group to delete
 */
export async function deleteGroup(groupId: string): Promise<void> {
  await saveGrowingSpace(groupId, {}, true);
}

/**
 * Fetches a single group by ID
 * @param groupId - ID of the group to fetch
 * @returns Promise with the group data or null if not found
 */
export async function getGroupById(groupId: string): Promise<GroupWithId | null> {
  try {
    const docRef = doc(db, 'groups', groupId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return null;
    if (snap.data().createdBy !== requireUserId()) throw new Error('This growing space is not in your account.');
    
    return { id: snap.id, ...(snap.data() as Group) };
  } catch (error) {
    logger.error('Error fetching group details:', error);
    throw new Error('Could not load this garden.');
  }
}

/**
 * Waters all plants in the group using the provided userId
 * @param groupId - ID of the group containing plants to water
 * @param userId - ID of the user performing the action
 */
export async function waterAllPlantsInGroup(
  groupId: string,
  userId: string,
) {
  return waterGrowingSpace(groupId);
}
