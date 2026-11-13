import { nextWateringRepeat, validWateringRepeat } from '../wateringRepeat';
const routine = { enabled: true, everyDays: 3, time: '08:00', waterMl: 500, timeZone: 'Africa/Johannesburg', startOn: '2026-11-13' } as const;
it('starts after the recorded activity and never schedules in the past', () => {
  expect(new Date(nextWateringRepeat(routine, Date.parse('2026-11-13T10:00Z'))).toISOString()).toBe('2026-11-16T06:00:00.000Z');
  expect(new Date(nextWateringRepeat(routine, Date.parse('2026-11-20T10:00Z'))).toISOString()).toBe('2026-11-22T06:00:00.000Z');
});
it('keeps local time across daylight saving changes', () => {
  const value = { ...routine, everyDays: 1, timeZone: 'America/New_York', startOn: '2026-10-31' };
  expect(new Date(nextWateringRepeat(value, Date.parse('2026-10-31T14:00Z'))).toISOString()).toBe('2026-11-01T13:00:00.000Z');
});
it('rejects impossible intervals, dates, amounts, times and zones', () => {
  for (const invalid of [{ everyDays: 0 }, { everyDays: 1.5 }, { everyDays: 366 }, { waterMl: 0 }, { waterMl: Infinity }, { time: '25:00' }, { timeZone: 'Invalid/Zone' }, { startOn: '2026-02-30' }]) expect(validWateringRepeat({ ...routine, ...invalid })).toBe(false);
});
