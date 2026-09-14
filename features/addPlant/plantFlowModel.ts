import type { PlantForm } from '@/features/plants/form/PlantForm';

export const stages = [
  { value: 'germination', label: 'Germination', detail: 'Starting from a seed', icon: 'seed-outline' },
  { value: 'seedling', label: 'Seedling', detail: 'A small, young plant', icon: 'sprout-outline' },
  { value: 'vegetative', label: 'Vegetative', detail: 'Established leafy growth', icon: 'leaf' },
  { value: 'flowering', label: 'Flowering', detail: 'Flowers are forming', icon: 'flower-outline' },
  { value: 'clone', label: 'Clone', detail: 'Starting from a cutting', icon: 'content-cut' },
] as const;
export const soilOptions = [
  { value: 'native', label: 'Native soil' }, { value: 'raised', label: 'Raised bed soil' },
  { value: 'store', label: 'Potting soil' }, { value: 'custom', label: 'Custom mix' },
];
export const protectionOptions = [
  { value: 'cage', label: 'Cage' }, { value: 'netting', label: 'Netting' },
  { value: 'row_cover', label: 'Row cover' }, { value: 'animal_fence', label: 'Animal fence' },
  { value: 'none', label: 'None' }, { value: 'other', label: 'Other' },
];
export type FormErrors = Partial<Record<keyof PlantForm, string>>;

export function validatePlantForm(form: PlantForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Give your plant a name to continue.';
  if (!stages.some(stage => stage.value === form.growthStage)) errors.growthStage = 'Choose a growth stage.';
  if (!['outdoor', 'indoor', 'greenhouse'].includes(form.environment)) errors.environment = 'Choose an environment.';
  if (!['pot', 'ground'].includes(form.plantedIn)) errors.plantedIn = 'Choose a pot or the ground.';
  if (form.ageDays.trim() && (!/^\d+$/.test(form.ageDays.trim()) || Number(form.ageDays) > 36500)) {
    errors.ageDays = 'Enter a whole number from 0 to 36,500 days.';
  }
  if (form.soilPh?.trim() && (!/^\d+(\.\d+)?$/.test(form.soilPh.trim()) || Number(form.soilPh) > 14)) {
    errors.soilPh = 'Enter a pH between 0 and 14, or leave it blank.';
  }
  if (form.location && (!Number.isFinite(form.location.lat) || !Number.isFinite(form.location.lng) ||
    Math.abs(form.location.lat) > 90 || Math.abs(form.location.lng) > 180)) {
    errors.location = 'Enter a valid latitude (−90 to 90) and longitude (−180 to 180).';
  }
  return errors;
}

export function normalizePlantForm(form: PlantForm): PlantForm {
  const normalized = { ...form };
  for (const key of Object.keys(normalized) as (keyof PlantForm)[]) {
    if (typeof normalized[key] === 'string') Object.assign(normalized, { [key]: (normalized[key] as string).trim() });
  }
  // Discard values from controls that no longer apply after changing the setup.
  if (normalized.plantedIn === 'ground') normalized.potSize = '';
  if (normalized.environment === 'indoor') normalized.sunlightExposure = '';
  if (normalized.environment === 'outdoor') normalized.sensorProfileId = null;
  normalized.companionPlants = [...new Set((normalized.companionPlants || []).map(value => value.trim()).filter(Boolean))];
  return normalized;
}

export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not added';
  if (value === undefined || value === null || value === '') return 'Not added';
  const str = String(value).replace(/_/g, ' ');
  return str.charAt(0).toUpperCase() + str.slice(1);
}
