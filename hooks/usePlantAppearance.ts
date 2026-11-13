import { useEffect } from 'react';
import { readPlantAppearance, subscribePlantAppearance, type PlantAppearance } from '@/services/plantAppearance';
import { useAsyncResource } from './useAsyncResource';

export function usePlantAppearance() {
  const resource = useAsyncResource<PlantAppearance>('plant-appearance', readPlantAppearance, 'grove', 'Appearance could not be loaded.');
  const refresh = resource.refresh;
  useEffect(() => subscribePlantAppearance(refresh), [refresh]);
  return { themeName: resource.data, error: resource.error, status: resource.status };
}
