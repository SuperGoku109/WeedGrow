import * as Notifications from 'expo-notifications';
import { syncStageReminders } from '../stageReminders.native';
import { claimStageNotification, postponeStageNotification } from '../stageNotificationClaims';
import type { Plant } from '@/firestoreModels';
import { stagePushPlan, stageSuggestion } from '@/lib/plants/growthTracking';
jest.mock('../stageNotificationClaims', () => ({ claimStageNotification: jest.fn(), postponeStageNotification: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({ setNotificationChannelAsync: jest.fn(), AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' }, getAllScheduledNotificationsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), getPermissionsAsync: jest.fn(), scheduleNotificationAsync: jest.fn() }));
const plant = { id: 'p', name: 'Hops', owners: ['owner'], growthStage: 'seedling', stageStartedOn: '2026-01-01', status: 'active', locationTimeZone: 'Africa/Johannesburg', stageReminders: { enabled: true } } as Plant & { id: string };
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-15T12:00:00Z'));
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as any);
  jest.mocked(claimStageNotification).mockResolvedValue(true);
});
afterEach(() => jest.useRealTimers());
it('schedules a deterministic date reminder after an authoritative cross-device claim', async () => {
  await syncStageReminders('owner', [plant], true);
  expect(claimStageNotification).toHaveBeenCalledWith('p', 'owner', { key: 'seedling:2026-01-01:0:0', dueAt: Date.parse('2026-01-22T08:00:00Z') });
  const request = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
  expect(request.identifier).toBe('weedgrow-stage:owner:p:seedling:2026-01-01:0:0');
  expect(request.content.data).toMatchObject({ ownerUid: 'owner', plantId: 'p' });
  expect(request.content.body).toContain('check physical signs');
});
it('does not deliver when a prior evaluation or another device has claimed the suggestion', async () => {
  jest.mocked(claimStageNotification).mockResolvedValue(false);
  await syncStageReminders('owner', [plant], true);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
it('cancels a pending push after a review while preserving weather/care notifications', async () => {
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
    { identifier: 'weedgrow-stage:owner:p:old', content: { data: { plantId: 'p', ownerUid: 'owner', stageKey: 'seedling:2026-01-01:0:0' } } },
    { identifier: 'weedgrow-intelligence:owner:weather', content: { data: {} } },
  ] as any);
  await syncStageReminders('owner', [{ ...plant, stageReview: { suggestionId: 'seedling:2026-01-01:0', action: 'not_yet', snoozes: 0, nextCheckOn: '2026-01-22' } }], true);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weedgrow-stage:owner:p:old');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
it('keeps an already scheduled push through live claim updates and cancels on sign-out', async () => {
  const notification = { identifier: 'weedgrow-stage:owner:p:seedling:2026-01-01:0:0', content: { data: { plantId: 'p', ownerUid: 'owner', stageKey: 'seedling:2026-01-01:0:0', stageSettings: JSON.stringify([plant.stageReminders, plant.growthProfile, plant.locationTimeZone, plant.location]) } } };
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([notification] as any);
  await syncStageReminders('owner', [{ ...plant, stagePush: { key: 'seedling:2026-01-01:0:0', dueAt: Date.parse('2026-01-22T08:00:00Z') } }], true);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  await syncStageReminders(undefined, [], false);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(notification.identifier);
});
it('respects device permission, the pending notification budget and care alerts', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false } as any);
  await syncStageReminders('owner', [plant], true);
  expect(claimStageNotification).not.toHaveBeenCalled();
  await syncStageReminders('owner', [plant], true, Date.parse('2026-01-23T08:00:00Z'));
  expect(claimStageNotification).not.toHaveBeenCalled();
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue(Array.from({ length: 63 }, (_, i) => ({ identifier: `care:${i}` })) as any);
  await syncStageReminders('owner', [plant], true);
  expect(claimStageNotification).not.toHaveBeenCalled();
});
it('plans harvest readiness with a stable key during progress, then keeps it after that progress card is dismissed', async () => {
  jest.setSystemTime(new Date('2026-02-01T12:00:00Z'));
  const flowering = { ...plant, growthStage: 'flowering' as const };
  await syncStageReminders('owner', [flowering], true);
  const request = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
  expect(request.content.data?.stageKey).toBe('flowering:2026-01-01:0:harvest:0');
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([{ ...request }] as any);
  jest.setSystemTime(new Date('2026-02-12T12:00:00Z'));
  const progress = stageSuggestion(flowering)!;
  const reviewed = { ...flowering, stagePush: { key: String(request.content.data?.stageKey), dueAt: Number(request.content.data?.stageDueAt) }, lastStageReviewedOn: '2026-02-12', stageReview: { suggestionId: progress.id, action: 'dismiss' as const, nextCheckOn: null, snoozes: 0 } };
  jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
  await syncStageReminders('owner', [reviewed], true);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  // A late response moves the next check past the already reserved device date.
  jest.setSystemTime(new Date('2026-02-25T12:00:00Z'));
  jest.mocked(postponeStageNotification).mockResolvedValueOnce({ key: String(request.content.data?.stageKey), dueAt: Date.parse('2026-03-04T08:00:00Z') });
  await syncStageReminders('owner', [{ ...reviewed, lastStageReviewedOn: '2026-02-25' }], true);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(request.identifier);
  expect(postponeStageNotification).toHaveBeenCalledWith('p', 'owner', { key: 'flowering:2026-01-01:0:harvest:0', dueAt: Number(request.content.data?.stageDueAt) });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: request.identifier, trigger: expect.objectContaining({ date: new Date('2026-03-04T08:00:00Z') }) }));
});
it('keeps a newly selected day-18 seedling’s device reminder three days ahead', async () => {
  const selected = { ...plant, stageStartedOn: '2025-12-28', stageReview: { suggestionId: 'seedling:2025-12-28:0', action: 'stage_recorded' as const, nextCheckOn: '2026-01-18', snoozes: 0 } };
  expect(stagePushPlan(selected, new Date())?.dueAt).toBe(Date.parse('2026-01-18T08:00:00Z'));
});
