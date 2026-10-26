import { normalizePlantSetup, validatePlantDatesAndReminders } from '../plantRules';
it('clears incompatible setup fields for both complete forms and partial edits', () => {
  expect(normalizePlantSetup({ environment: 'outdoor', plantedIn: 'ground', sensorProfileId: 'old', potSize: '5L' })).toMatchObject({ sensorProfileId: null, potSize: null });
  expect(normalizePlantSetup({ sunlightExposure: 'Full Sun' }, { environment: 'indoor', plantedIn: 'pot' }).sunlightExposure).toBeNull();
  expect(normalizePlantSetup({ notes: 'A note' }, { environment: 'indoor', plantedIn: 'ground' })).toEqual({ notes: 'A note' });
});
it('uses the same reminder bounds and calendar-day rules at every write boundary', () => {
  expect(validatePlantDatesAndReminders({ reminderSchedule: { type: 'interval', intervalDays: 366 } })).toHaveProperty('reminderSchedule');
  expect(validatePlantDatesAndReminders({ reminderSchedule: { type: 'custom', customDays: ['mon'], timeOfDay: '25:00' } })).toHaveProperty('reminderSchedule');
  expect(validatePlantDatesAndReminders({ startedOn: '2026-10-25' }, '2026-10-25')).toEqual({});
  expect(validatePlantDatesAndReminders({ startedOn: '2026-02-30' }, '2026-10-25')).toHaveProperty('startedOn');
});
