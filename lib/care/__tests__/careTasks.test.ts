import { buildCareTasks, reminderDue, routineDays } from '../careTasks';
import type { Plant, PlantLog } from '@/firestoreModels';
const now = new Date('2026-10-20T12:00:00');
const timestamp = (date: string) => ({ toDate: () => new Date(date) } as never);
const plant = { id: 'p', name: 'Test', strain: '', owners: ['user-a'], growthStage: 'seedling', environment: 'outdoor', plantedIn: 'pot', updatedAt: timestamp('2026-10-01T12:00:00'), status: 'active', wateringFrequency: 'Every 2 days', feedingFrequency: 'Weekly', createdAt: timestamp('2026-10-01T12:00:00') } as Plant & { id: string };
it('sets the next routine from completed care and preserves the local calendar date', () => {
  const tasks = buildCareTasks(plant, [{ type: 'watering', updatedBy: 'user-a', timestamp: timestamp('2026-10-19T16:00:00') } as PlantLog], now);
  expect(tasks.find(task => task.kind === 'watering')?.due).toEqual(new Date('2026-10-21T09:00:00'));
});
it('keeps archived and harvested plants out of the checklist', () => {
  expect(buildCareTasks({ ...plant, status: 'harvested' }, [], now)).toEqual([]);
  expect(buildCareTasks({ ...plant, status: 'archived' }, [], now)).toEqual([]);
});
it('does not invent a care frequency for an unspecified routine', () => {
  expect(routineDays('As needed')).toBeNull();
  expect(buildCareTasks({ ...plant, wateringFrequency: '', feedingFrequency: '' }, [], now)).toEqual([]);
});
it('advances a custom weekday schedule after completion today', () => {
  const task = buildCareTasks({ ...plant, reminderSchedule: { type: 'custom', customDays: ['tue', 'fri'], timeOfDay: '08:30' } }, [{ type: 'watering', updatedBy: 'user-a', timestamp: timestamp('2026-10-20T10:00:00') } as PlantLog], now)[0];
  expect(task.due).toEqual(new Date('2026-10-23T08:30:00')); expect(task.completedToday).toBe(true);
});
it('keeps a skipped check separate from completed care and resumes on a permitted day', () => {
  const skipped = { ...plant, careSkips: { watering: '2026-10-20' }, reminderSchedule: { type: 'custom' as const, customDays: ['tue', 'fri'], timeOfDay: '08:30' } };
  const task = buildCareTasks(skipped, [], now)[0];
  expect(task.skippedToday).toBe(true); expect(task.completedToday).toBe(false);
  expect(reminderDue(task, 0, now)).toEqual(new Date('2026-10-23T08:30:00'));
  expect(buildCareTasks(skipped, [], new Date('2026-10-21T12:00:00'))[0].skippedToday).toBe(false);
});
it('snoozing changes the reminder time without completing the task', () => {
  const task = buildCareTasks(plant, [], now)[0];
  expect(reminderDue(task, now.getTime() + 3600000, now)).toEqual(new Date(now.getTime() + 3600000));
  expect(task.completedToday).toBe(false);
});
it('uses the plant timezone for completion and next care time', () => {
  const instant = new Date('2026-10-20T23:30:00Z');
  const plant = { id: 'zoned', name: 'Zoned', status: 'active', wateringFrequency: 'Every day', locationTimeZone: 'Africa/Johannesburg' } as any;
  const [task] = buildCareTasks(plant, [{ type: 'watering', calendarDay: '2026-10-21', timestamp: { toDate: () => instant } } as any], instant);
  expect(task.completedToday).toBe(true);
  expect(task.due.toISOString()).toBe('2026-10-22T07:00:00.000Z');
});
