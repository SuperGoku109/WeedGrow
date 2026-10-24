import { recordHarvest } from '../api/plantLifecycle';
import { runTransaction } from 'firebase/firestore';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('@/lib/logs/journalRepository', () => ({ newLogId: () => 'request' }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, ...path) => path.join('/')), runTransaction: jest.fn(), serverTimestamp: () => 'server-time', Timestamp: { fromDate: (date: Date) => date } }));
const set = jest.fn(); const update = jest.fn();
let plant: Record<string, unknown>;
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-24T23:30:00Z'));
  plant = { owners: ['owner'], status: 'active', locationTimeZone: 'Asia/Tokyo' };
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ exists: () => true, data: () => plant }), set, update } as never));
});
afterEach(() => jest.useRealTimers());
it('accepts the plant local day and saves its explicit date, zone and matching timestamp', async () => {
  await recordHarvest('p', '2026-10-25', 10, 'Harvest');
  expect(set).toHaveBeenCalledWith('plants/p/logs/harvest_request', expect.objectContaining({ calendarDay: '2026-10-25', timeZone: 'Asia/Tokyo', timestamp: new Date('2026-10-25T03:00:00Z') }));
});
it('rejects a date in the future at the plant location before writing', async () => {
  plant.locationTimeZone = 'America/Los_Angeles';
  await expect(recordHarvest('p', '2026-10-25', undefined, '')).rejects.toThrow('earlier');
  expect(set).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
});
it('keeps a committed retry idempotent when the plant status has already changed', async () => {
  plant = { ...plant, status: 'harvested', harvest: { recordId: 'request' } };
  await recordHarvest('p', '2026-10-25', 10, 'Harvest');
  expect(set).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
});
