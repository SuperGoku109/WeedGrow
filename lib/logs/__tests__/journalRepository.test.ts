import { getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { saveJournalEntry, deleteJournalEntry, validateMeasurements } from '../journalRepository';
jest.mock('@/services/session', () => ({ requireUserId: jest.fn(() => 'user-a') }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'logs'), doc: jest.fn((_db, ...parts) => ({ id: parts.at(-1) || 'request', path: parts.join('/') })),
  serverTimestamp: jest.fn(() => 'server-time'), query: jest.fn(), where: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), runTransaction: jest.fn(), Timestamp: { fromDate: (date: Date) => date },
}));
const set = jest.fn(); const remove = jest.fn(); const get = jest.fn();
beforeEach(() => {
  jest.mocked(getDoc).mockImplementation(async ref => get(ref));
  jest.mocked(getDocs).mockResolvedValue({ docs: [], empty: true } as never);
  get.mockImplementation(async ref => ref.path === 'plants/p' ? { exists: () => true, data: () => ({ owners: ['user-a'], status: 'active' }) } : { exists: () => false });
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get, set, delete: remove } as never));
});
it('uses the same watering document for competing devices on the same local date', async () => {
  await saveJournalEntry('p', { type: 'watering', updatedBy: '' }, '2026-09-10', undefined, 'request-a');
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/p/logs/watering_2026-09-10' }), expect.objectContaining({ mutationId: 'request-a' }));
  get.mockImplementation(async ref => ref.path === 'plants/p' ? { exists: () => true, data: () => ({ owners: ['user-a'], status: 'active' }) } : { exists: () => true, data: () => ({ mutationId: 'request-a' }) });
  await expect(saveJournalEntry('p', { type: 'watering', updatedBy: '' }, '2026-09-10', undefined, 'request-b')).rejects.toThrow('already logged');
});
it('preserves historical date and measurement units', async () => {
  await saveJournalEntry('p', { type: 'fertilizing', nutrientMlPerL: 1.5, updatedBy: '' }, '2026-09-10', undefined, 'request-a');
  expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ timestamp: new Date('2026-09-10T12:00:00'), nutrientMlPerL: 1.5 }));
});
it('rejects another account before writing', async () => {
  get.mockResolvedValue({ exists: () => true, data: () => ({ owners: ['user-b'] }) });
  await expect(saveJournalEntry('p', { type: 'note', updatedBy: '' })).rejects.toThrow('account'); expect(set).not.toHaveBeenCalled();
});
it('only undoes the exact saved mutation', async () => {
  get.mockResolvedValue({ exists: () => true, data: () => ({ mutationId: 'newer' }) });
  await expect(deleteJournalEntry('p', 'log', 'original')).rejects.toThrow('changed'); expect(remove).not.toHaveBeenCalled();
});
it('validates numerical measurements rather than saving NaN or impossible values', () => {
  expect(() => validateMeasurements({ type: 'note', updatedBy: '', ph: 15 })).toThrow('pH');
  expect(() => validateMeasurements({ type: 'watering', updatedBy: '', waterMl: NaN })).toThrow('water amount');
});
