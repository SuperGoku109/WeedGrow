import { wateringHistory } from '../wateringHistory';
import { effectiveSchedule } from '../reminderSchedules';
import { contextualCareTasks } from '../contextualReminders';
import { buildCareTasks } from '../careTasks';
import { validatePlantFields } from '@/lib/plants/plantValidation';
import { careConfiguration } from '@/lib/careAlgorithm/outdoorContext';
import { evaluateLocalCare, defaultLocalCareSettings } from '@/lib/careAlgorithm/localCare';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
import { buildSectionUpdates } from '@/features/plants/form/plantSectionForm';
import type { PlantLog } from '@/firestoreModels';
const now = new Date('2026-11-10T12:00:00Z');
const plant = makePlantSummary({ locationTimeZone: 'UTC', potSize: '10 L' });
const log = (type: PlantLog['type'], extra = {}) => ({ type, timestamp: makeTimestamp(now), occurrencePrecision: 'time' as const, updatedBy: 'owner', ...extra });
test('chart separates unknown volumes, missing days, zero and recorded amounts', () => {
  const rows = wateringHistory([log('watering', { waterMl: 500, id: 'a' }), log('watering', { id: 'b' }), log('note', { moistureState: 'MOIST', id: 'c' })], '2026-11-09', '2026-11-10', 'UTC', now);
  expect(rows[0]).toMatchObject({ waterMl: null, wateringCount: 0 });
  expect(rows[1]).toMatchObject({ waterMl: 500, unknownAmounts: 1, checks: ['MOIST'] });
  expect(wateringHistory([log('watering', { waterMl: 0 })], '2026-11-10', '2026-11-10', 'UTC', now)[0].waterMl).toBe(0);
});
test('chart rejects future records and deduplicates journal IDs', () => {
  const recorded = log('watering', { waterMl: 200, id: 'a' });
  const rows = wateringHistory([recorded, recorded, log('watering', { waterMl: 900, timestamp: makeTimestamp(new Date(now.getTime() + 60000)) })], '2026-11-10', '2026-11-10', 'UTC', now);
  expect(rows[0].waterMl).toBe(200);
});
test('chart groups precise events locally and preserves a date-only event day', () => {
  const rows = wateringHistory([log('watering', { waterMl: 100, id: 'precise', timestamp: makeTimestamp(new Date('2026-11-09T23:00:00Z')) }), log('watering', { waterMl: 300, id: 'dated', occurrencePrecision: 'date', calendarDay: '2026-11-09' })], '2026-11-09', '2026-11-10', 'Africa/Johannesburg', now);
  expect(rows.map(r => r.waterMl)).toEqual([300, 100]);
});
test('explicit modes override legacy frequencies independently', () => {
  const p = { ...plant, wateringFrequency: 'Every day', feedingFrequency: 'Weekly', reminderSchedule: { type: 'none' as const }, feedingReminderSchedule: { type: 'custom' as const, customDays: ['fri'], timeOfDay: '10:00' } };
  expect(effectiveSchedule(p, 'watering').type).toBe('none'); expect(buildCareTasks(p, [], now).map(t => t.kind)).toEqual(['feeding']);
});
test('smart watering does not also produce a repeating custom watering task', () => {
  expect(buildCareTasks({ ...plant, reminderSchedule: { type: 'smart' } }, [], now)).toEqual([]);
});
test('feeding has its own interval and weekday schedules', () => {
  const tasks = buildCareTasks({ ...plant, reminderSchedule: { type: 'none' }, feedingReminderSchedule: { type: 'interval', intervalDays: 14, timeOfDay: '16:30' } }, [log('fertilizing')], now);
  expect(tasks[0]).toMatchObject({ kind: 'feeding', intervalDays: 14, mode: 'custom' });
  expect(tasks[0].due.toISOString()).toBe('2026-11-24T16:30:00.000Z');
});
test('smart feeding requires an interval entered from the product label', () => {
  expect(validatePlantFields({ feedingReminderSchedule: { type: 'smart' } })).toHaveProperty('feedingReminderSchedule');
  expect(validatePlantFields({ feedingReminderSchedule: { type: 'smart', intervalDays: 21, timeOfDay: '09:00' } })).toEqual({});
});
test('smart feeding reviews can align with a future soil check using a fresh algorithm result', () => {
  const p = { ...plant, createdAt: makeTimestamp(now), feedingReminderSchedule: { type: 'smart' as const, intervalDays: 14 } };
  const tasks = buildCareTasks(p, [], now);
  const evaluation = evaluateLocalCare(p, [], defaultLocalCareSettings(now.getTime() / 1000), now.getTime() / 1000, undefined, undefined, [], { basis: [] });
  evaluation.outdoor!.nextCheckUtc = now.getTime() / 1000 + 3600;
  const adjusted = contextualCareTasks(tasks, new Map([[plant.id, evaluation]]), now.getTime() / 1000);
  expect(adjusted[0].due.toISOString()).toBe('2026-11-10T13:00:00.000Z'); expect(adjusted[0].reviewReason).toContain('product label');
  evaluation.outdoor!.nextCheckUtc = now.getTime() / 1000 + 7 * 86400;
  expect(contextualCareTasks(tasks, new Map([[plant.id, evaluation]]), now.getTime() / 1000)[0].due.getTime()).toBe(tasks[0].due.getTime() + 86400000);
  const overdue = { ...tasks[0], due: new Date(now.getTime() - 3 * 86400000) };
  expect(contextualCareTasks([overdue], new Map([[plant.id, evaluation]]), now.getTime() / 1000)[0].due.getTime()).toBeLessThan(now.getTime());
  evaluation.nextEvaluationUtc = now.getTime() / 1000 - 1;
  expect(contextualCareTasks(tasks, new Map([[plant.id, evaluation]]), now.getTime() / 1000)[0].due).toEqual(tasks[0].due);
});
test('new context is optional, validated and invalidates learned configuration without inferring exposure', () => {
  expect(validatePlantFields({ potMaterial: 'fabric', potType: 'grow_bag', growingSite: 'balcony', potDrainage: 'holes' })).toEqual({});
  expect(validatePlantFields({ potMaterial: 'invented' })).toHaveProperty('potMaterial');
  expect(careConfiguration({ ...plant, potMaterial: 'terracotta' })).not.toBe(careConfiguration(plant));
  const updates = buildSectionUpdates('Growing setup', { environment: 'outdoor', plantedIn: 'pot', potSize: '10 L', growingSite: 'balcony', rainExposure: 'unknown' }, 'custom', plant);
  expect(updates).not.toHaveProperty('rainReception'); expect(updates.growingSite).toBe('balcony');
});
