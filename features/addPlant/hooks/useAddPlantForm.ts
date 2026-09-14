import { useCallback, useState } from 'react';
import type { PlantForm } from '@/features/plants/form/PlantForm';

const initialForm: PlantForm = {
  name: '',
  strain: '', // set to empty string by default
  growthStage: 'germination',
  ageDays: '', // changed from '0' to ''
  environment: 'outdoor',
  plantedIn: 'pot',
  potSize: '',
  sunlightExposure: '',
  sensorProfileId: '',
  location: undefined,
  locationNickname: '',
  wateringFrequency: '',
  fertilizer: '',
  pests: [],
  trainingTags: [],
  notes: '',
  imageUri: '',
};

export function useAddPlantForm() {
  const [form, setForm] = useState<PlantForm>(initialForm);
  const setField = useCallback(<K extends keyof PlantForm>(field: K, value: PlantForm[K]) => {
    setForm((prev: PlantForm) => ({ ...prev, [field]: value }));
  }, []);
  const resetForm = useCallback(() => setForm(initialForm), []);
  return { form, setField, resetForm };
}
