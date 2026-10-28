import { getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { ensureCareSummary } from '../careSummaries';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(() => ({ path: 'plants/test' })), limit: jest.fn(), orderBy: jest.fn(), query: jest.fn(), where: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), runTransaction: jest.fn() }));
const update = jest.fn();
const plant = (revision: number) => ({ data: () => ({ owners: ['owner'], careRevision: revision }) });
beforeEach(() => { update.mockClear(); jest.mocked(getDocs).mockResolvedValue({ docs: [], metadata: { fromCache: false } } as never); });
it('retries a changed revision instead of committing a mixed snapshot', async () => {
  jest.mocked(getDoc).mockResolvedValueOnce(plant(0) as never).mockResolvedValueOnce(plant(1) as never);
  const get = jest.fn().mockResolvedValueOnce(plant(1)).mockResolvedValueOnce(plant(1));
  jest.mocked(runTransaction).mockImplementation(async (_db, body) => body({ get, update } as never));
  await ensureCareSummary('race');
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(expect.anything(), { careSummary: { version: 1, revision: 1, watering: null, fertilizing: null } });
});
it('never persists a cached partial query result as authoritative history', async () => {
  jest.mocked(getDoc).mockResolvedValue(plant(0) as never);
  jest.mocked(getDocs).mockResolvedValueOnce({ docs: [], metadata: { fromCache: true } } as never);
  await ensureCareSummary('cached');
  expect(update).not.toHaveBeenCalled(); expect(runTransaction).not.toHaveBeenCalled();
});
