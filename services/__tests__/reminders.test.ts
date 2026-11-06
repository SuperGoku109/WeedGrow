import * as Notifications from 'expo-notifications';
import { syncReminders } from '../reminders.native';
import { buildCareTasks } from '@/lib/care/careTasks';
import type { Plant } from '@/firestoreModels';
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(), scheduleNotificationAsync: jest.fn(),
}));
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-05T08:00:00Z'));
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
    { identifier: 'weedgrow:old-user:p:watering:old' }, { identifier: 'another-app' },
  ] as any);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as any);
  jest.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue('scheduled');
});
afterEach(() => jest.useRealTimers());
test('disabling reminders removes app notifications without touching other notifications or scheduling care', async () => {
  await syncReminders('owner', [], false);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weedgrow:old-user:p:watering:old');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('another-app');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test('configured routine reminders respect plant time/weekday, bounded delivery and truthful wording', async () => {
  const plant = { id: 'p', name: 'Hops', status: 'active', locationTimeZone: 'Africa/Johannesburg',
    reminderSchedule: { type: 'custom', customDays: ['fri'], timeOfDay: '09:00' } } as Plant & { id: string };
  const tasks = buildCareTasks(plant, [], new Date());
  await syncReminders('owner', tasks, true);
  const calls = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map(([request]) => request);
  expect(calls.length).toBeGreaterThan(0); expect(calls.length).toBeLessThanOrEqual(50);
  expect(new Set(calls.map(r => r.identifier)).size).toBe(calls.length);
  for (const request of calls) {
    const date = (request.trigger as { date: Date }).date;
    expect(date.getUTCDay()).toBe(5); expect(date.getUTCHours()).toBe(7);
    expect(request.content.body).toContain('routine is scheduled');
    expect(request.content.body).not.toMatch(/watering is due|infection|mildew|root rot/);
    expect(request.content.data).toMatchObject({ plantId: 'p', ownerUid: 'owner' });
  }
});
