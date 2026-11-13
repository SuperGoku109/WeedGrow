import type { PlantLog } from '@/firestoreModels';
import { validateLogDate, type JournalCategory } from '@/lib/logs/plantJournal';
import { measurementError, measurementKeys, type MeasurementKey } from '@/lib/logs/logMeasurements';
export type ActivityErrors = Partial<Record<MeasurementKey | 'date' | 'description' | 'repeatEveryDays' | 'repeatTime' | 'repeatWaterMl', string>>;
export function activityMeasurements(category?: JournalCategory) {
  return measurementKeys.filter(key => key === 'waterMl' ? category === 'watering' : key === 'nutrientMlPerL' ? category === 'feeding' : category === 'measurements');
}
export function validateActivityForm(category: JournalCategory, description: string, date: string, raw: Record<string, string>, today: string, existing?: Partial<PlantLog>) {
  const errors: ActivityErrors = {};
  const invalidDate = validateLogDate(date, today);
  if (invalidDate) errors.date = invalidDate;
  const values: Partial<PlantLog> = {};
  if (raw.moistureState && ['DRY', 'MOIST', 'WET'].includes(raw.moistureState)) { values.moistureState = raw.moistureState as PlantLog['moistureState']; if (raw.moistureConfiguration) values.moistureConfiguration = raw.moistureConfiguration; }
  if (values.moistureState && ['useful', 'too_early', 'too_late'].includes(raw.inspectionFeedback)) values.inspectionFeedback = raw.inspectionFeedback as PlantLog['inspectionFeedback'];
  if (['LIGHT', 'MODERATE', 'HEAVY'].includes(raw.rainfallObservation)) values.rainfallObservation = raw.rainfallObservation as PlantLog['rainfallObservation'];
  for (const key of activityMeasurements(category)) {
    const input = (raw[key] || '').trim();
    if (!input) continue;
    const decimal = input.replace(',', '.');
    const value = /^\d+(\.\d+)?$|^\.\d+$/.test(decimal) ? Number(decimal) : NaN;
    const error = measurementError(key, value);
    if (error) errors[key] = error;
    else values[key] = value;
  }
  // Keep previously saved readings when editing older combined activities.
  // New readings belong exclusively to the Measurements activity.
  if (category !== 'measurements') for (const key of ['ph', 'heightCm', 'soilMoisture'] as const) {
    if (existing?.[key] != null) values[key] = existing[key];
  }
  if (category === 'watering' && raw.repeatChanged === '1') {
    if (raw.repeatEnabled !== '1') values.wateringRepeatChange = { enabled: false };
    else {
      const everyDays = Number(raw.repeatEveryDays), waterMl = Number((raw.repeatWaterMl || '').replace(',', '.'));
      if (!Number.isInteger(everyDays) || everyDays < 1 || everyDays > 365) errors.repeatEveryDays = 'Choose an interval from 1 to 365 days.';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.repeatTime || '')) errors.repeatTime = 'Use a time such as 08:00.';
      if (!Number.isFinite(waterMl) || waterMl <= 0 || waterMl > 1000000) errors.repeatWaterMl = 'Enter a water amount above 0 and up to 1,000,000 ml.';
      if (!Object.keys(errors).length) values.wateringRepeatChange = { enabled: true, everyDays, time: raw.repeatTime, waterMl, timeZone: raw.repeatTimeZone || 'UTC', startOn: date };
    }
  }
  if (description.length > 4000) errors.description = 'Keep observations under 4,000 characters.';
  if (!description.trim() && !['watering', 'feeding', 'repotting', 'flushing'].includes(category) && !(['health', 'measurements'].includes(category) && Object.keys(values).length)) errors.description = category === 'measurements' ? 'Add a reading or an observation.' : category === 'health' ? 'Describe the check, or choose a soil condition.' : 'Add a short observation before saving.';
  return { errors, values, description: description.trim() || (['health', 'measurements'].includes(category) && Object.keys(values).length ? category === 'measurements' ? 'Measurements recorded.' : 'Health measurements recorded.' : '') };
}
