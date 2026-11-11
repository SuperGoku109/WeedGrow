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
it('always supplies a numeric planning age for unknown or invalid legacy ages', () => {
  expect(plantAgeDays(plant({ growthStage: 'seedling', ageKnown: false, ageDays: 0 }))).toBe(25);
  expect(plantAgeDays(plant({ startedOn: '2026-02-30' }), '2026-03-05')).toBe(0);
  expect(plantAgeDays(plant({ startedOn: '2026-10-25' }), '2026-10-24')).toBe(0);
  expect(plantAgeDays(plant({ ageDays: -1 }))).toBe(0);
  expect(plantAgeLabel(plant({ ageDays: 1 }))).toBe('1 day (recorded)');
});
it('advances a legacy stage estimate from its saved reference date instead of resetting it each day', () => {
  const value = plant({ growthStage: 'vegetative', ageKnown: false, ageDays: 0, createdAt: { toDate: () => new Date('2026-10-01T12:00:00Z') } as Plant['createdAt'] });
  expect(plantAgeDays(value, '2026-10-08')).toBe(137);
  expect(plantAgeLabel(value, '2026-10-08')).toBe('About 137 days (stage estimate)');
});
