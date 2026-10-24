import { plantAgeDays, plantAgeLabel } from '../plantAge';
import type { Plant } from '@/firestoreModels';
const plant = (fields: Partial<Plant>) => fields as Plant;
it('uses the same growing age for summaries and labels, including leap days', () => {
  const value = plant({ startedOn: '2024-02-28', ageDays: 1, ageEstimated: true });
  expect(plantAgeDays(value, '2024-03-01')).toBe(2);
  expect(plantAgeLabel(value, '2024-03-01')).toBe('About 2 days');
});
it('uses the plant local day rather than the viewing device day', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-24T23:30:00Z'));
  expect(plantAgeDays(plant({ startedOn: '2026-10-24', locationTimeZone: 'Asia/Tokyo' }))).toBe(1);
  expect(plantAgeDays(plant({ startedOn: '2026-10-24', locationTimeZone: 'America/Los_Angeles' }))).toBe(0);
  jest.useRealTimers();
});
it('keeps unknown or invalid ages out of averages and preserves legacy recorded ages', () => {
  expect(plantAgeDays(plant({ ageKnown: false, ageDays: 0 }))).toBeNull();
  expect(plantAgeDays(plant({ startedOn: '2026-02-30' }), '2026-03-05')).toBeNull();
  expect(plantAgeDays(plant({ startedOn: '2026-10-25' }), '2026-10-24')).toBeNull();
  expect(plantAgeDays(plant({ ageDays: -1 }))).toBeNull();
  expect(plantAgeLabel(plant({ ageDays: 1 }))).toBe('1 day (recorded)');
});
