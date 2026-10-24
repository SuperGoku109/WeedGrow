import { plantDay, zonedTime, addDays } from '../plantDay';
it('uses the plant day even when the viewer is on another calendar day', () => {
  const date = new Date('2026-10-20T23:30:00Z');
  expect(plantDay(date, 'Africa/Johannesburg')).toBe('2026-10-21');
  expect(plantDay(date, 'America/Los_Angeles')).toBe('2026-10-20');
});
it('resolves local care times with the offset for that date', () => {
  expect(zonedTime('2026-10-21', '09:00', 'Africa/Johannesburg').toISOString()).toBe('2026-10-21T07:00:00.000Z');
  expect(zonedTime('2026-03-07', '09:00', 'America/New_York').toISOString()).toBe('2026-03-07T14:00:00.000Z');
  expect(zonedTime('2026-03-08', '09:00', 'America/New_York').toISOString()).toBe('2026-03-08T13:00:00.000Z');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
});

it('reuses timezone formatters across dates instead of reconstructing them per plant', () => {
  const Original = Intl.DateTimeFormat;
  const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args) => new Original(...args));
  plantDay(new Date('2026-10-20T12:00:00Z'), 'Pacific/Auckland');
  plantDay(new Date('2026-10-21T12:00:00Z'), 'Pacific/Auckland');
  expect(spy).toHaveBeenCalledTimes(1); spy.mockRestore();
});
