import type { Plant } from '@/firestoreModels';
export const MEDIUMS = ['', 'soil', 'soilless_mix', 'coco', 'other'] as const;
export const RAIN_EXPOSURES = ['unknown', 'exposed', 'sheltered', 'partial', 'soil_sheltered'] as const;
export function rainExposure(plant: Pick<Plant, 'rainReception'>): string {
  const rain = plant.rainReception;
  if (rain?.soil === 'yes' && rain.canopy === 'yes') return 'exposed';
  if (rain?.soil === 'no' && rain.canopy === 'no') return 'sheltered';
  if (rain?.soil === 'no' && rain.canopy === 'yes') return 'soil_sheltered';
  if (rain?.soil === 'partial' && rain.canopy === 'partial') return 'partial';
  return 'unknown';
}
export function rainReception(exposure: string): NonNullable<Plant['rainReception']> {
  switch (exposure) {
    case 'exposed': return { soil: 'yes', canopy: 'yes' };
    case 'sheltered': return { soil: 'no', canopy: 'no' };
    case 'soil_sheltered': return { soil: 'no', canopy: 'yes' };
    case 'partial': return { soil: 'partial', canopy: 'partial' };
    default: return { soil: 'unknown', canopy: 'unknown' };
  }
}
