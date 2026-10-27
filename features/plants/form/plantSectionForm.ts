import type { Plant } from '@/firestoreModels';
import { plantDay, addDays } from '@/lib/dates/plantDay';
import { validateLogDate } from '@/lib/logs/plantJournal';
import { validatePlantFields } from '@/lib/plants/plantValidation';
export type Field = { key: string; label: string; options?: string[]; number?: boolean; multiline?: boolean; list?: boolean };
export const sections: Record<string, Field[]> = {
  'Basics': [{ key: 'name', label: 'Plant name' }, { key: 'strain', label: 'Strain name' }, { key: 'strainType', label: 'Strain type', options: ['unknown', 'sativa', 'indica', 'hybrid'] }, { key: 'startedOn', label: 'Started growing on (YYYY-MM-DD)' }, { key: 'growthStage', label: 'Growth stage', options: ['germination', 'seedling', 'vegetative', 'flowering', 'clone'] }, { key: 'ageDays', label: 'Age in days (optional estimate)', number: true }, { key: 'height', label: 'Height (cm)', number: true }],
  'Growing setup': [{ key: 'environment', label: 'Environment', options: ['outdoor', 'greenhouse', 'indoor'] }, { key: 'plantedIn', label: 'Planted in', options: ['pot', 'ground'] }, { key: 'potSize', label: 'Pot size' }, { key: 'sensorProfileId', label: 'Sensor profile', options: [] }, { key: 'sunlightExposure', label: 'Sunlight', options: ['', 'Full Sun', 'Partial Sun', 'Mostly Shade', 'Not Sure'] }, { key: 'soilType', label: 'Soil type', options: ['', 'native', 'raised', 'store', 'custom'] }, { key: 'soilPh', label: 'Soil pH' }, { key: 'permanentProtection', label: 'Protection' }, { key: 'companionPlants', label: 'Companion plants (comma separated)', list: true }],
  'Care plan': [{ key: 'wateringFrequency', label: 'Watering routine', options: ['', 'Every day', 'Every 2 days', 'Every 3 days', 'Weekly'] }, { key: 'feedingFrequency', label: 'Feeding routine', options: ['', 'Every day', 'Every 2 days', 'Every 3 days', 'Weekly', 'Every 14 days', 'Monthly', 'As needed'] }, { key: 'fertilizer', label: 'Fertilizer' }, { key: 'reminderType', label: 'Reminder', options: ['none', 'interval', 'custom'] }, { key: 'intervalDays', label: 'Reminder interval (days)', number: true }, { key: 'customDays', label: 'Reminder days (Mon, Tue, Wed, Thu, Fri, Sat, Sun)' }, { key: 'timeOfDay', label: 'Reminder time (HH:MM)' }],
  'Location and weather': [{ key: 'locationNickname', label: 'Location nickname (optional)' }, { key: 'locationLabel', label: 'Town or area' }, { key: 'lat', label: 'Latitude', number: true }, { key: 'lng', label: 'Longitude', number: true }],
  'Notes and history': [{ key: 'notes', label: 'Lasting notes', multiline: true }, { key: 'environmentNotes', label: 'Setup notes', multiline: true }, { key: 'trainingTags', label: 'Training (comma separated)', list: true }, { key: 'pests', label: 'Pest history (comma separated)', list: true }],
};
export function buildSectionUpdates(section: string, values: Record<string, string>, locationMode: 'custom' | 'space', plant: Plant, today = plantDay(new Date(), plant.locationTimeZone), ageMode?: 'date' | 'estimate') {
  const fields = sections[section] || sections.Basics;
    const fail = (message: string): never => { throw new Error(message); };
    if (section === 'Basics' && !values.name.trim()) return fail('Enter a plant name.');
    for (const field of fields.filter(item => item.number && !['lat', 'lng'].includes(item.key))) {
      const raw = values[field.key];
      if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) return fail(field.label + ' must be a non-negative number.');
    }
    if (values.ageDays && (!Number.isInteger(Number(values.ageDays)) || Number(values.ageDays) > 36500)) return fail('Age must be a whole number between 0 and 36,500.');
    if (values.soilPh && (!Number.isFinite(Number(values.soilPh)) || Number(values.soilPh) < 0 || Number(values.soilPh) > 14)) return fail('Soil pH must be between 0 and 14.');
    const updates: Record<string, unknown> = {};
    if (section === 'Location and weather') {
      if (!!values.lat.trim() !== !!values.lng.trim()) return fail('Enter both coordinates or leave both blank.');
      if (values.lat.trim() && (!Number.isFinite(Number(values.lat)) || !Number.isFinite(Number(values.lng)) || Math.abs(Number(values.lat)) > 90 || Math.abs(Number(values.lng)) > 180)) return fail('Enter valid latitude and longitude.');
      updates.location = values.lat.trim() ? { lat: Number(values.lat), lng: Number(values.lng) } : null;
      updates.locationNickname = values.locationNickname.trim();
      updates.locationLabel = values.locationLabel.trim();
      updates.locationMode = locationMode;
    } else {
      for (const field of fields.filter(item => !['reminderType', 'intervalDays', 'customDays', 'timeOfDay'].includes(item.key))) {
        const value = values[field.key].trim();
        updates[field.key] = field.list ? value.split(',').map(part => part.trim()).filter(Boolean) : field.number ? value ? Number(value) : null : value;
      }
      if (section === 'Basics') {
        updates.strainType = values.strainType || 'unknown';
        if (values.startedOn && validateLogDate(values.startedOn, today)) return fail('Use a valid start date, today or earlier (YYYY-MM-DD).');
        const ageChanged = values.ageDays.trim() !== String(plant.ageKnown === false ? '' : plant.ageDays ?? '');
        const useDate = ageMode ? ageMode === 'date' : !!values.startedOn && (!ageChanged || values.startedOn !== (plant.startedOn || ''));
        if (useDate && values.startedOn) {
          updates.ageDays = Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(values.startedOn + 'T00:00:00Z')) / 86400000);
          updates.startedOn = values.startedOn; updates.ageKnown = true; updates.ageEstimated = false;
        } else if (!useDate && values.ageDays.trim()) {
          if (!ageChanged && (plant.ageEstimated || !plant.startedOn)) {
            updates.startedOn = plant.startedOn || null;
            updates.ageEstimated = !!plant.ageEstimated;
            delete updates.ageDays;
          } else { updates.startedOn = addDays(today, -Number(values.ageDays)); updates.ageEstimated = true; }
          updates.ageKnown = true;
        } else { updates.startedOn = null; updates.ageKnown = false; updates.ageEstimated = false; }
      }
      if (section === 'Growing setup') {
        if (values.plantedIn === 'ground') updates.potSize = null;
        if (values.environment === 'indoor') updates.sunlightExposure = null;
        if (values.environment === 'outdoor') updates.sensorProfileId = null;
      }
      if (section === 'Care plan') {
        const type = values.reminderType;
        const days = values.customDays.split(',').map(day => day.trim().slice(0, 3).toLowerCase()).filter(Boolean);
        if (type === 'interval' && (!Number.isInteger(Number(values.intervalDays)) || Number(values.intervalDays) < 1)) return fail('Reminder interval must be a whole number of at least one day.');
        if (type === 'custom' && (!days.length || days.some(day => !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day)))) return fail('Choose valid reminder days, for example Mon, Wed, Fri.');
        if (type !== 'none' && values.timeOfDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.timeOfDay)) return fail('Use HH:MM for reminder time.');
        updates.reminderSchedule = { type, ...(type === 'interval' ? { intervalDays: Number(values.intervalDays) } : {}), ...(type === 'custom' ? { customDays: [...new Set(days)] } : {}), ...(type !== 'none' && values.timeOfDay ? { timeOfDay: values.timeOfDay } : {}) };
      }
    }
    const fieldErrors = validatePlantFields(updates, today);
    if (Object.keys(fieldErrors).length) return fail(Object.values(fieldErrors)[0]);
  return updates;
}
