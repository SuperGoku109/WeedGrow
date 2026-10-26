import { create } from 'zustand';
import type { PlantForm, PlantFieldSetter } from '../form/PlantForm';

export type GrowthStage = 'germination' | 'seedling' | 'vegetative' | 'flowering';
export type Environment = 'outdoor' | 'greenhouse' | 'indoor';
export type PlantedIn = 'pot' | 'ground';

const initialState: PlantForm = {
  name: '',
  strain: '',
  growthStage: 'germination',
  ageDays: '', // changed from '0' to ''
  environment: 'outdoor',
  plantedIn: 'pot',
  sensorProfileId: null,
};

export const usePlantForm = create<PlantForm & {
  setField: PlantFieldSetter;
  reset: () => void;
}>((set) => ({
  ...initialState,
  setField: (key, value) => set((state) => ({ ...state, [key]: value })),
  reset: () => set(initialState),
}));
