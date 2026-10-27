import { validateLogDate, type JournalCategory } from '@/lib/logs/plantJournal';
import { measurementError, measurementKeys, type MeasurementKey } from '@/lib/logs/logMeasurements';
export type ActivityErrors = Partial<Record<MeasurementKey | 'date' | 'description', string>>;
export function activityMeasurements(category?: JournalCategory) {
  return measurementKeys.filter(key => key === 'waterMl' ? category === 'watering' : key === 'nutrientMlPerL' ? category === 'feeding' : true);
}
export function validateActivityForm(category: JournalCategory, description: string, date: string, raw: Record<string, string>, today: string) {
  const errors: ActivityErrors = {};
  const invalidDate = validateLogDate(date, today);
  if (invalidDate) errors.date = invalidDate;
  const values: Partial<Record<MeasurementKey, number>> = {};
  for (const key of activityMeasurements(category)) {
    const input = (raw[key] || '').trim();
    if (!input) continue;
    const decimal = input.replace(',', '.');
    const value = /^\d+(\.\d+)?$|^\.\d+$/.test(decimal) ? Number(decimal) : NaN;
    const error = measurementError(key, value);
    if (error) errors[key] = error;
    else values[key] = value;
  }
  if (description.length > 4000) errors.description = 'Keep observations under 4,000 characters.';
  if (!description.trim() && !['watering', 'feeding'].includes(category) && !(category === 'health' && Object.keys(values).length)) errors.description = category === 'health' ? 'Describe what you checked, or add a measurement.' : 'Add a short observation before saving.';
  return { errors, values, description: description.trim() || (category === 'health' && Object.keys(values).length ? 'Health measurements recorded.' : '') };
}
