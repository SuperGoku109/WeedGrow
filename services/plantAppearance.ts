import AsyncStorage from '@react-native-async-storage/async-storage';
import { gardenThemes } from '@/design-system/tokens/garden';

export type PlantAppearance = keyof typeof gardenThemes;
const key = 'weedgrow.plant-theme';
const subscribers = new Set<() => void>();

export async function readPlantAppearance(): Promise<PlantAppearance> {
  const value = await AsyncStorage.getItem(key);
  return value && Object.hasOwn(gardenThemes, value) ? value as PlantAppearance : 'grove';
}

export async function savePlantAppearance(value: PlantAppearance) {
  if (!Object.hasOwn(gardenThemes, value)) throw new Error('Choose an available theme.');
  await AsyncStorage.setItem(key, value);
  subscribers.forEach(listener => listener());
}

export function subscribePlantAppearance(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}
