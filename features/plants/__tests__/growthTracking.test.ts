import { confirmGrowthStage, reviewGrowthSuggestion, recordPreflowerObservation } from '../api/growthTracking';
import { runTransaction } from 'firebase/firestore';
import type { Plant } from '@/firestoreModels';
import { stageSuggestion } from '@/lib/plants/growthTracking';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('@/lib/logs/journalRepository', () => ({ newLogId: () => 'request' }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, ...path) => path.join('/')), runTransaction: jest.fn(), serverTimestamp: () => 'server-time', Timestamp: { fromDate: (date: Date) => date } }));
const set = jest.fn(); const update = jest.fn();
let plant: Plant; let logExists: boolean;
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-02-10T12:00:00Z'));
  plant = { owners: ['owner'], name: 'Hops', growthStage: 'seedling', stageStartedOn: '2026-01-01', stageRevision: 2, status: 'active', locationTimeZone: 'Africa/Johannesburg' } as Plant;
  logExists = false;
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async (ref: string) => ({ exists: () => ref.includes('/logs/') ? logExists : true, data: () => plant }), set, update } as never));
});
afterEach(() => jest.useRealTimers());
it('atomically records a dated user-confirmed transition and history', async () => {
  await confirmGrowthStage('p', 'vegetative', '2026-02-05', 2);
  expect(update).toHaveBeenCalledWith('plants/p', expect.objectContaining({ growthStage: 'vegetative', stageStartedOn: '2026-02-05', stageRevision: 3, stageReview: expect.objectContaining({ action: 'stage_recorded', nextCheckOn: '2026-03-03' }) }));
  expect(set).toHaveBeenCalledWith('plants/p/logs/stage_request', expect.objectContaining({ type: 'stage_change', fromStage: 'seedling', toStage: 'vegetative', calendarDay: '2026-02-05', timestamp: new Date('2026-02-05T10:00:00Z') }));
});
it('accepts dated physical observations even without a due seasonal suggestion or flowering profile', async () => {
  plant = { ...plant, growthStage: 'vegetative', stageStartedOn: '2026-02-01', emergedOn: '2026-01-20', growthProfile: undefined };
  await recordPreflowerObservation('p', '2026-02-08', 2);
  const fields = update.mock.calls[0][1];
  expect(fields).toMatchObject({ preflowerObservedOn: '2026-02-08', stageReview: { action: 'early_signs', nextCheckOn: '2026-02-17' } });
  expect(fields).not.toHaveProperty('growthStage');
  plant = { ...plant, ...fields };
  expect(stageSuggestion(plant, new Date('2026-02-16T12:00:00Z'))).toBeNull();
  expect(stageSuggestion(plant, new Date('2026-02-17T12:00:00Z'))?.target).toBe('flowering');
});
it('rejects early observations before actual emergence, after harvest, or on a stale stage revision', async () => {
  plant = { ...plant, growthStage: 'vegetative', emergedOn: '2026-02-05' };
  await expect(recordPreflowerObservation('p', '2026-02-01', 2)).rejects.toThrow('before');
  await expect(recordPreflowerObservation('p', '2026-02-06', 1)).rejects.toThrow('changed');
  plant.status = 'harvested';
  await expect(recordPreflowerObservation('p', '2026-02-06', 2)).rejects.toThrow('living vegetative');
  expect(update).not.toHaveBeenCalled();
});
it('rejects an impossible stage date before writing either the plant or journal', async () => {
  plant = { ...plant, emergedOn: '2026-01-10', stageStartedOn: '2026-01-10' };
  await expect(confirmGrowthStage('p', 'vegetative', '2026-01-05', 2)).rejects.toThrow('preceding recorded');
  expect(update).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
});
it('rejects stale revisions, future dates, unauthorized owners and unrecorded harvests', async () => {
  await expect(confirmGrowthStage('p', 'vegetative', '2026-02-05', 1)).rejects.toThrow('changed');
  await expect(confirmGrowthStage('p', 'vegetative', '2026-02-11', 2)).rejects.toThrow('earlier');
  await expect(confirmGrowthStage('p', 'drying', '2026-02-05', 2)).rejects.toThrow('harvest');
  plant.owners = ['other'];
  await expect(confirmGrowthStage('p', 'vegetative', '2026-02-05', 2)).rejects.toThrow('account');
  expect(set).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
});
it('treats committed request retries as idempotent even after the stage has changed', async () => {
  logExists = true;
  await confirmGrowthStage('p', 'vegetative', '2026-02-05', 1);
  expect(update).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
});
it('saves a rejection without changing stage, and rejects a duplicate stale review', async () => {
  const suggestion = stageSuggestion(plant)!;
  await reviewGrowthSuggestion('p', suggestion.id, 'not_yet');
  const fields = update.mock.calls[0][1];
  expect(fields).not.toHaveProperty('growthStage');
  expect(fields.stageReview.nextCheckOn).toBe('2026-02-17');
  plant = { ...plant, ...fields };
  await expect(reviewGrowthSuggestion('p', suggestion.id, 'snooze')).rejects.toThrow('changed');
});
it('records early signs as an observation while remaining vegetative', async () => {
  plant = { ...plant, growthStage: 'vegetative', germinationStartedOn: '2026-01-01', growthProfile: { flowering: 'age_based' } };
  await reviewGrowthSuggestion('p', stageSuggestion(plant)!.id, 'early_signs');
  expect(update).toHaveBeenCalledWith('plants/p', expect.objectContaining({ preflowerObservedOn: '2026-02-10' }));
  expect(update.mock.calls[0][1]).not.toHaveProperty('growthStage');
  expect(update.mock.calls[0][1].stageReview.nextCheckOn).toBe('2026-02-17');
});
it('rejects restarting growth after harvest but permits correcting its date', async () => {
  plant = { ...plant, growthStage: 'harvested', status: 'harvested', harvestedOn: '2026-02-01', harvest: { date: '2026-02-01', recordId: 'original', notes: '' } };
  await expect(confirmGrowthStage('p', 'flowering', '2026-02-01', 2)).rejects.toThrow('Harvest ended');
  expect(update).not.toHaveBeenCalled();
  await confirmGrowthStage('p', 'harvested', '2026-02-02', 2);
  expect(update).toHaveBeenCalledWith('plants/p', expect.objectContaining({ status: 'harvested', harvestedOn: '2026-02-02', harvest: expect.objectContaining({ date: '2026-02-02' }) }));
  expect(set).toHaveBeenCalledWith('plants/p/logs/harvest_original', expect.objectContaining({ calendarDay: '2026-02-02', type: 'harvest' }), { merge: true });
});
