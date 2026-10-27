import type { PlantLog } from '@/firestoreModels';
export const measurementFields = {
  waterMl: { label: 'Water amount', unit: 'ml', max: 1000000 },
  nutrientMlPerL: { label: 'Nutrient dose', unit: 'ml/L', max: 1000 },
  ph: { label: 'pH', unit: 'pH', max: 14 },
  heightCm: { label: 'Height', unit: 'cm', max: 10000 },
  soilMoisture: { label: 'Soil moisture', unit: '%', max: 100 },
} as const;
export type MeasurementKey = keyof typeof measurementFields;
export const measurementKeys = Object.keys(measurementFields) as MeasurementKey[];
export function measurementError(key: MeasurementKey, value: number) {
  const field = measurementFields[key];
  return !Number.isFinite(value) || value < 0 || value > field.max ? `Enter ${key === 'ph' ? 'pH' : field.label.toLowerCase()} between 0 and ${field.max.toLocaleString('en-GB')}${key === 'ph' ? '' : ' ' + field.unit}.` : '';
}
export function validateMeasurements(log: Partial<PlantLog>) {
  for (const key of measurementKeys) {
    if (log[key] != null && measurementError(key, log[key]!)) throw new Error(measurementError(key, log[key]!));
  }
  if ((log.description?.length || 0) > 4000) throw new Error('Keep observations under 4,000 characters.');
}
