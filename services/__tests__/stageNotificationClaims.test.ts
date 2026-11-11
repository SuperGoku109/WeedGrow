import { postponeStageNotification } from '../stageNotificationClaims';
import { runTransaction } from 'firebase/firestore';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, ...parts) => parts.join('/')), runTransaction: jest.fn(), serverTimestamp: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }) }));
const key = 'flowering:2026-01-01:0:harvest:0';
const previous = { key, dueAt: Date.parse('2026-02-26T08:00:00Z') };
let plant: Record<string, any>;
const update = jest.fn();
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-02-25T12:00:00Z'));
  plant = { name: 'Plant', owners: ['owner'], environment: 'outdoor', plantedIn: 'pot', status: 'active', growthStage: 'flowering', stageStartedOn: '2026-01-01', locationTimeZone: 'Africa/Johannesburg', stageReminders: { enabled: true }, stagePush: previous,
    lastStageReviewedOn: '2026-02-25', stageReview: { suggestionId: 'flowering:2026-01-01:0:progress', action: 'not_yet', nextCheckOn: '2026-03-18', snoozes: 0 } };
  update.mockImplementation((_ref, values) => Object.assign(plant, values));
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ exists: () => true, data: () => plant }), update } as never));
});
afterEach(() => jest.useRealTimers());
it('atomically postpones the same still-pending reservation and rejects a stale repeat', async () => {
  expect(await postponeStageNotification('p', 'owner', previous)).toEqual({ key, dueAt: Date.parse('2026-03-04T08:00:00Z') });
  expect(await postponeStageNotification('p', 'owner', previous)).toBeNull();
  expect(update).toHaveBeenCalledTimes(1);
});
it('never rearms an elapsed/delivered reservation or one owned by another account', async () => {
  jest.setSystemTime(new Date('2026-03-01T12:00:00Z'));
  expect(await postponeStageNotification('p', 'owner', previous)).toBeNull();
  jest.setSystemTime(new Date('2026-02-25T12:00:00Z'));
  plant.owners = ['other'];
  expect(await postponeStageNotification('p', 'owner', previous)).toBeNull();
  expect(await postponeStageNotification('p', 'other', previous)).toBeNull();
  expect(update).not.toHaveBeenCalled();
});
