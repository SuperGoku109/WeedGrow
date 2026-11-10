import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { syncCareRecommendations } from '../reminders.native';
import type { CareRecommendation } from '@/lib/careAlgorithm/outdoorIntelligence';
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' }, setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(), AndroidImportance: { DEFAULT: 3 },
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]), cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }), scheduleNotificationAsync: jest.fn().mockResolvedValue('sent'),
}));
const now = Date.parse('2026-11-09T12:00:00Z') / 1000;
const recommendation: CareRecommendation = { id: 'plant:weather:wind', plantId: 'plant', type: 'weather', category: 'wind', priority: 'HIGH',
  action: 'PREPARE_AND_INSPECT', title: 'Secure plants', description: 'Strong winds are forecast.', reasonCodes: ['forecast_wind'], evidence: {},
  dataQuality: 'PARTIAL', generatedAt: now, expiresAt: now + 1800, status: 'active' };
beforeEach(async () => { jest.useFakeTimers().setSystemTime(now * 1000); await AsyncStorage.clear(); });
afterEach(() => jest.useRealTimers());
test('repeated weather refreshes do not send the same recommendation again', async () => {
  await syncCareRecommendations('owner', [recommendation], true);
  jest.setSystemTime((now + 10) * 1000);
  await syncCareRecommendations('owner', [{ ...recommendation, generatedAt: now + 10 }], true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ data: { plantId: 'plant', ownerUid: 'owner' } }) }));
});
test('disabled preferences, denied permission and expired findings do not notify', async () => {
  await syncCareRecommendations('owner', [recommendation], false);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
  await syncCareRecommendations('owner', [recommendation], true);
  await syncCareRecommendations('owner', [{ ...recommendation, expiresAt: now }], true);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test('condition resolution clears dedup state so a later recurrence is meaningful', async () => {
  await syncCareRecommendations('owner', [recommendation], true);
  await syncCareRecommendations('owner', [], true);
  await syncCareRecommendations('owner', [recommendation], true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
});

test('a partial delivery failure does not resend already delivered findings', async () => {
  const second = { ...recommendation, id: 'plant:weather:wind2' };
  jest.mocked(Notifications.scheduleNotificationAsync).mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('transient'));
  await expect(syncCareRecommendations('owner', [recommendation, second], true)).rejects.toThrow('transient');
  await syncCareRecommendations('owner', [recommendation, second], true);
  const ids = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map(([request]) => request.identifier);
  expect(ids.filter(id => id === `weedgrow-intelligence:owner:${recommendation.id}`)).toHaveLength(1);
  expect(ids.filter(id => id === `weedgrow-intelligence:owner:${second.id}`)).toHaveLength(2);
});
test('planned soil checks use the native date trigger without claiming watering or current soil moisture', async () => {
  const soil: CareRecommendation = { ...recommendation, id: 'plant:watering:soil-check', type: 'watering', category: 'soil-check', priority: 'LOW', action: 'REVIEW_SOIL', evidence: { nextCheckUtc: now + 3600 } };
  await syncCareRecommendations('owner', [soil], true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'weedgrow-intelligence:owner:plant:watering:soil-check:planned-check',
    trigger: { type: 'date', date: new Date((now + 3600) * 1000), channelId: 'care' }, content: expect.objectContaining({ title: 'Check soil moisture' }) }));
});
test('an already delivered planned check does not immediately duplicate on app resume', async () => {
  const soil: CareRecommendation = { ...recommendation, id: 'plant:watering:soil-check', type: 'watering', category: 'soil-check', priority: 'LOW', action: 'REVIEW_SOIL', evidence: { nextCheckUtc: now + 3600 } };
  await syncCareRecommendations('owner', [soil], true);
  jest.setSystemTime((now + 3601) * 1000);
  await syncCareRecommendations('owner', [{ ...soil, priority: 'MEDIUM', generatedAt: now + 3601, expiresAt: now + 4000, evidence: { nextCheckUtc: now + 3600, checkStatus: 'CHECK_NOW' } }], true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});
