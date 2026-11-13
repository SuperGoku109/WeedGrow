import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlantAppearance = 'grove' | 'daylight';
const key = 'weedgrow.plant-theme';
const subscribers = new Set<() => void>();

export async function readPlantAppearance(): Promise<PlantAppearance> {
  return await AsyncStorage.getItem(key) === 'daylight' ? 'daylight' : 'grove';
}

export async function savePlantAppearance(value: PlantAppearance) {
  await AsyncStorage.setItem(key, value);
  subscribers.forEach(listener => listener());
}

export function subscribePlantAppearance(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}
