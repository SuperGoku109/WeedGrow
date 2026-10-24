import type { PlantForm } from '@/features/plants/form/PlantForm';
import { localDateKey, validateLogDate } from '@/lib/logs/plantJournal';
import { validatePlantFields, MAX_PLANT_AGE_DAYS } from '@/lib/plants/plantValidation';

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

export function validatePlantForm(form: PlantForm, today = localDateKey()): FormErrors {
  const errors = validatePlantFields({ name: form.name, strainType: form.strainType || 'unknown', growthStage: form.growthStage, environment: form.environment, plantedIn: form.plantedIn, ageDays: form.ageDays.trim() ? Number(form.ageDays) : null, soilPh: form.soilPh, location: form.location }) as FormErrors;
  if (form.ageDays.trim() && (!/^\d+$/.test(form.ageDays.trim()) || Number(form.ageDays) > MAX_PLANT_AGE_DAYS)) {
    errors.ageDays = 'Enter a whole number from 0 to 36,500 days.';
  }
  if (form.ageMode === 'date' && (!form.startedOn || validateLogDate(form.startedOn, today))) errors.startedOn = 'Enter a valid start date, today or earlier, using YYYY-MM-DD.';
  if (form.ageMode === 'date' && form.startedOn && Date.parse(today + 'T00:00:00Z') - Date.parse(form.startedOn + 'T00:00:00Z') > 36500 * 86400000) errors.startedOn = 'Use a start date within the last 100 years.';
  if (form.ageMode === 'estimate' && !form.ageDays.trim()) errors.ageDays = 'Enter an estimated age, or choose Unknown.';
  for (const key of ['lastWateredOn', 'lastFedOn'] as const) {
    if (form[key] && validateLogDate(form[key]!, today)) errors[key] = 'Use a valid date, today or earlier (YYYY-MM-DD).';
    else if (form[key] && form.ageMode === 'date' && form.startedOn && form[key]! < form.startedOn) errors[key] = 'This activity cannot be before the plant’s start date.';
  }
  if ((form.latitudeInput?.trim() || form.longitudeInput?.trim()) && !form.location) errors.location = 'Enter both valid coordinates, or remove the location to continue.';
  return errors;
}

export function normalizePlantForm(form: PlantForm, today = localDateKey()): PlantForm {
  const normalized = { ...form };
  for (const key of Object.keys(normalized) as (keyof PlantForm)[]) {
    if (typeof normalized[key] === 'string') Object.assign(normalized, { [key]: (normalized[key] as string).trim() });
  }
  normalized.locationMode = normalized.locationMode === 'space' && normalized.groupId ? 'space' : 'custom';
  // Discard values from controls that no longer apply after changing the setup.
  if (normalized.plantedIn === 'ground') normalized.potSize = '';
  if (normalized.environment === 'indoor') normalized.sunlightExposure = '';
  if (normalized.environment === 'outdoor') normalized.sensorProfileId = null;
  normalized.companionPlants = [...new Set((normalized.companionPlants || []).map(value => value.trim()).filter(Boolean))];
  const mode = normalized.ageMode || (normalized.ageDays ? 'estimate' : 'unknown');
  normalized.ageMode = mode;
  normalized.ageEstimated = mode === 'estimate';
  if (mode === 'unknown') { normalized.ageDays = ''; normalized.startedOn = ''; }
  else if (mode === 'date' && normalized.startedOn && !validateLogDate(normalized.startedOn, today)) {
    const day = (value: string) => Date.parse(value + 'T00:00:00Z') / 86400000;
    normalized.ageDays = String(day(today) - day(normalized.startedOn));
  } else if (mode === 'estimate' && /^\d+$/.test(normalized.ageDays) && Number(normalized.ageDays) <= 36500) {
    const started = new Date(today + 'T12:00:00');
    started.setDate(started.getDate() - Number(normalized.ageDays));
    normalized.startedOn = localDateKey(started);
  }
  return normalized;
}

export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not added';
  if (value === undefined || value === null || value === '') return 'Not added';
  const str = String(value).replace(/_/g, ' ');
  return str.charAt(0).toUpperCase() + str.slice(1);
}
