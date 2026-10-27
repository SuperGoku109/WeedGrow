import { plantProfile, profileDate, reminderLabel } from '../plantProfile';
import type { Plant } from '@/firestoreModels';
const plant = { name: 'Test', strain: '', growthStage: 'seedling', status: 'active', environment: 'outdoor', plantedIn: 'pot', ageKnown: false, owners: [], createdAt: null, updatedAt: null } satisfies Plant;
it('keeps meaningful zero measurements and hides unknown or empty values', () => {
  const profile = plantProfile({ ...plant, height: 0, soilPh: '0', notes: '  ' });
  expect(profile.basics).toContainEqual(expect.objectContaining({ label: 'Height', value: '0 cm' }));
  expect(profile.basics.some(field => field.value === 'Unknown')).toBe(false);
  expect(profile.setup).toContainEqual(expect.objectContaining({ label: 'Soil pH', value: '0' }));
  expect(profile.notes).toEqual([]);
});
it('preserves long notes and all saved setup, care, location and record information', () => {
  const timestamp = { toDate: () => new Date('2026-10-17T12:00:00Z') } as Plant['createdAt'];
  const profile = plantProfile({ ...plant, strain: 'A long strain name', startedOn: '2026-10-01', ageKnown: true, potSize: '20 L', sunlightExposure: 'Morning sun', soilType: 'store', permanentProtection: 'shade_cloth', companionPlants: ['Basil'], wateringFrequency: 'Every 3 days', feedingFrequency: 'Weekly', fertilizer: 'Blend', reminderSchedule: { type: 'custom', customDays: ['mon', 'fri'], timeOfDay: '08:00' }, location: { lat: -33.9, lng: 18.6 }, locationTimeZone: 'Invalid/Legacy', sensorProfileId: 'sensor', notes: 'Long notes\n'.repeat(100), trainingTags: ['LST'], pests: ['Aphids'], createdAt: timestamp, updatedAt: timestamp });
  expect(profile.setup.map(field => field.value)).toEqual(expect.arrayContaining(['Potting soil', 'Shade cloth', 'Basil']));
  expect(profile.care.map(field => field.value)).toContain('Mon, Fri at 08:00');
  expect(profile.technical.map(field => field.value)).toContain('-33.9000, 18.6000');
  expect(profile.notes[0].value).toBe('Long notes\n'.repeat(100));
  expect(profile.record).toHaveLength(2);
});
it('formats reminders and calendar dates without interpreting an added date as plant age', () => {
  expect(reminderLabel({ type: 'none' })).toBe('Reminders off');
  expect(reminderLabel({ type: 'interval', intervalDays: 1 })).toBe('Every day');
  expect(profileDate('2026-02-31')).toBeUndefined();
  expect(profileDate('2026-10-01')).toBe('1 Oct 2026');
  expect(plantProfile(plant).basics.find(field => field.label === 'Growing for')).toBeUndefined();
});
