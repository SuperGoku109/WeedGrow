import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { Platform } from 'react-native';

export const INITIAL_PLANT_FORM: PlantForm = {
  name: '', strain: '', strainType: '', growthStage: '', ageDays: '', ageMode: 'unknown', startedOn: '',
  environment: 'outdoor', plantedIn: 'pot', potSize: '', sunlightExposure: '',
  sensorProfileId: '', location: null, locationNickname: '', locationLabel: '', locationMode: 'custom',
  wateringFrequency: '', feedingFrequency: '', lastWateredOn: '', lastFedOn: '',
  fertilizer: '', pests: [], trainingTags: [], notes: '', imageUri: '', groupId: '', groupName: '',
};
export interface PlantDraft { version: 1; form: PlantForm; step: number; plantId: string; savedAt: string }
export const draftKey = (uid?: string) => `weedgrow.add-plant.v1.${uid || 'device'}`;
export function decodeDraft(raw: string | null): PlantDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PlantDraft;
    if (value.version !== 1 || !value.form || typeof value.form.name !== 'string' || typeof value.plantId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value.plantId) || !Number.isInteger(value.step) || value.step < 0 || value.step > 4) return null;
    const form = { ...INITIAL_PLANT_FORM, ...value.form };
    const textFields = ['locationMode', 'name', 'strain', 'strainType', 'growthStage', 'ageDays', 'ageMode', 'startedOn', 'environment', 'plantedIn', 'potSize', 'sunlightExposure', 'soilType', 'soilPh', 'permanentProtection', 'environmentNotes', 'wateringFrequency', 'feedingFrequency', 'fertilizer', 'notes', 'imageUri', 'locationNickname', 'locationLabel', 'groupId', 'groupName', 'lastWateredOn', 'lastFedOn', 'latitudeInput', 'longitudeInput'] as const;
    if (textFields.some(key => form[key] != null && typeof form[key] !== 'string')) return null;
    for (const key of ['pests', 'trainingTags', 'companionPlants'] as const) if (form[key] && (!Array.isArray(form[key]) || form[key]!.some(item => typeof item !== 'string'))) return null;
    if (form.location && (!Number.isFinite(form.location.lat) || !Number.isFinite(form.location.lng))) form.location = null;
    // Object URLs and device temp files cannot survive reload/restart. New photo
    // selections are encoded before being put in a draft.
    if (form.imageUri && !/^(data:image\/jpeg;base64,|https?:\/\/|firestore-photo:)/.test(form.imageUri)) form.imageUri = '';
    return { ...value, form };
  } catch { return null; }
}
export const readDraft = async (key: string) => decodeDraft(await AsyncStorage.getItem(key));
export const writeDraft = (key: string, draft: PlantDraft) => AsyncStorage.setItem(key, JSON.stringify(draft));
export const removeDraft = (key: string) => AsyncStorage.removeItem(key);
// AsyncStorage uses this same key in localStorage on web. A synchronous exit
// write covers refresh immediately after typing, before a debounce can fire.
export function writeDraftOnExit(key: string, draft: PlantDraft) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(draft));
}
