import { normalizeWaterLog, type WaterLogFact } from '../logAdapter';
const fact: WaterLogFact = { type: 'watering', occurredUtc: 100, recordedUtc: 110, assertedUtc: 110, calendarDay: null, timeZone: null, precision: 'time', waterMl: 100 };
test('explicit amount units and zero survive; optional amount stays unknown', () => {
  expect(normalizeWaterLog('e', 1, fact, 120).event).toMatchObject({ appliedL: .1, startUtc: 100, endUtc: 100 });
  expect(normalizeWaterLog('e', 1, { ...fact, waterMl: 0 }, 120).event).toMatchObject({ appliedL: 0 });
  expect(normalizeWaterLog('e', 1, { ...fact, waterMl: null }, 120).event).toMatchObject({ appliedL: null });
});
test('date-only source logs retain DST bounds and do not become noon timestamps', () => {
  const log = { ...fact, precision: 'date', calendarDay: '2026-11-01', timeZone: 'America/New_York', recordedUtc: 1800000000 };
  const event = normalizeWaterLog('date', 1, log, 1800000000).event;
  expect(event && event.deleted !== true && (event.endUtc - event.startUtc) / 3600).toBe(25);
});
test('unknown precision can use a declared day/zone, but never the viewing device timezone', () => {
  expect(normalizeWaterLog('e', 1, { ...fact, precision: 'unknown' }, 120).event).toBeNull();
  expect(normalizeWaterLog('e', 1, { ...fact, precision: 'unknown', calendarDay: '1970-01-01', timeZone: 'UTC' }, 120).event).toMatchObject({ startUtc: 0, endUtc: 110 });
});
test('source deletion/type correction becomes a revisioned tombstone, not a zero-volume watering', () => {
  expect(normalizeWaterLog('e', 2, null, 120).event).toEqual({ id: 'e', revision: 2, deleted: true, availableUtc: 120 });
  expect(normalizeWaterLog('e', 2, { ...fact, type: 'note' }, 120).event).toMatchObject({ deleted: true });
  expect(normalizeWaterLog('e', 2, { ...fact, waterMl: -1 }, 120).event).toBeNull();
});
