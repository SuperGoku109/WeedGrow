/** Field policies shared by forms and the write boundary. Only supplied fields
 * are checked, so an unrelated edit can still repair a legacy record. */
export const PLANT_STAGES = ['germination', 'seedling', 'vegetative', 'flowering', 'clone'] as const;
export const PLANT_ENVIRONMENTS = ['outdoor', 'indoor', 'greenhouse'] as const;
export const MAX_PLANT_AGE_DAYS = 36500;
export function validatePlantFields(fields: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  if ('name' in fields && (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.trim().length > 100)) errors.name = 'Use a plant name of 1–100 characters.';
  const choices: Record<string, readonly string[]> = { growthStage: PLANT_STAGES, environment: PLANT_ENVIRONMENTS, plantedIn: ['pot', 'ground'], status: ['active', 'archived', 'harvested', 'dead'], strainType: ['unknown', 'sativa', 'indica', 'hybrid'], locationMode: ['custom', 'space'] };
  for (const [field, values] of Object.entries(choices)) if (field in fields && !values.includes(fields[field] as string)) errors[field] = `Choose a valid ${field === 'growthStage' ? 'growth stage' : field === 'strainType' ? 'strain type' : field === 'locationMode' ? 'location mode' : field}.`;
  for (const [field, max, label, integer] of [['ageDays', MAX_PLANT_AGE_DAYS, 'Age in days', true], ['height', 10000, 'Height in centimetres', false]] as const) {
    const value = fields[field];
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value)))) errors[field] = `${label} must be ${integer ? 'a whole number' : 'a number'} between 0 and ${max.toLocaleString('en-US')}.`;
  }
  if (fields.soilPh != null && fields.soilPh !== '') {
    const raw = fields.soilPh;
    if (!['string', 'number'].includes(typeof raw) || !/^\d+(\.\d+)?$/.test(String(raw).trim()) || Number(raw) > 14) errors.soilPh = 'Enter a pH between 0 and 14, or leave it blank.';
  }
  if (fields.location != null) {
    const location = fields.location as { lat?: unknown; lng?: unknown };
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) errors.location = 'Enter a valid latitude (−90 to 90) and longitude (−180 to 180).';
  }
  return errors;
}
export class PlantValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) { super(Object.values(fields)[0]); this.name = 'PlantValidationError'; }
}
export function assertValidPlantFields(fields: Record<string, unknown>) {
  const errors = validatePlantFields(fields);
  if (Object.keys(errors).length) throw new PlantValidationError(errors);
}
