import type { Plant } from '@/firestoreModels';

const fields = {
  name: 'Name', strain: 'Strain', strainType: 'Strain type', environment: 'Environment', plantedIn: 'Planted in',
  potSize: 'Pot size', potMaterial: 'Pot material', careMedium: 'Growing medium', sunlightExposure: 'Sunlight',
  height: 'Height (cm)', soilPh: 'Soil pH', soilType: 'Soil type', notes: 'Notes', environmentNotes: 'Environment notes',
  wateringFrequency: 'Watering frequency', fertilizer: 'Fertilizer', feedingFrequency: 'Feeding frequency',
  permanentProtection: 'Protection', companionPlants: 'Companion plants', pests: 'Pests', trainingTags: 'Training',
  startedOn: 'Planting date', ageDays: 'Recorded age (days)', imageUri: 'Cover photo', sensorProfileId: 'Sensor profile',
} as const;
export function plantEditHistory(previous: Plant, updates: Partial<Plant>) {
  const display = (value: unknown) => value == null || value === '' ? 'Not set' : Array.isArray(value) ? value.join(', ') || 'None' : String(value).replace(/_/g, ' ');
  return (Object.keys(fields) as (keyof typeof fields)[])
    .filter(key => key in updates && display(previous[key]) !== display(updates[key]))
    .map(key => key === 'imageUri' ? 'Cover photo changed.' : key === 'sensorProfileId' ? 'Sensor profile changed.' : `${fields[key]}: ${display(previous[key])} → ${display(updates[key])}`)
    .join('\n').slice(0, 4000);
}
