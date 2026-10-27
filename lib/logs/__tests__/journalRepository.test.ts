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

it('rejects a changed payload for an already committed request instead of falsely acknowledging it', async () => {
  const committed = { type: 'note', category: 'notes', description: 'First', calendarDay: '2026-09-10', mutationId: 'same-request', timestamp: { toDate: () => new Date('2026-09-10T12:00:00Z') } };
  get.mockImplementation(async ref => ref.path === 'plants/p' ? { exists: () => true, data: () => ({ owners: ['user-a'], status: 'active' }) } : { exists: () => true, data: () => committed });
  await expect(saveJournalEntry('p', { type: 'note', category: 'notes', description: 'Revised', updatedBy: '' }, '2026-09-10', undefined, 'same-request')).rejects.toThrow('different details');
  expect(set).not.toHaveBeenCalled();
  await saveJournalEntry('p', { type: 'note', category: 'notes', description: 'First', updatedBy: '' }, '2026-09-10', undefined, 'same-request');
  expect(set).not.toHaveBeenCalled();
});
it('preserves the original historical time zone and timestamp on an unchanged event date', async () => {
  const original = { id: 'entry', type: 'note', category: 'notes', description: 'First', calendarDay: '2026-09-10', timeZone: 'Africa/Johannesburg', mutationId: 'original', timestamp: { toDate: () => new Date('2026-09-10T12:30:00Z') }, updatedBy: 'user-a' } as any;
  get.mockImplementation(async ref => ref.path === 'plants/p' ? { exists: () => true, data: () => ({ owners: ['user-a'], status: 'active', locationTimeZone: 'Asia/Tokyo' }) } : { exists: () => true, data: () => original });
  await saveJournalEntry('p', { type: 'note', category: 'notes', description: 'Revised', updatedBy: '' }, '2026-09-10', original, 'new-request');
  expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ timeZone: 'Africa/Johannesburg', timestamp: original.timestamp }));
});
it('detects stale deletion even when the opened legacy record had no mutation id', async () => {
  get.mockResolvedValue({ exists: () => true, data: () => ({ mutationId: 'newer' }) });
  await expect(deleteJournalEntry('p', 'legacy', undefined)).rejects.toThrow('changed'); expect(remove).not.toHaveBeenCalled();
});
it('detects legacy edits without a revision id by comparing the full opened baseline', async () => {
  const opened = { id: 'legacy', type: 'note', description: 'Before', updatedBy: '', timestamp: new Date('2026-09-10T12:00:00Z') } as any;
  get.mockResolvedValue({ exists: () => true, data: () => ({ ...opened, description: 'After' }) });
  await expect(deleteJournalEntry('p', 'legacy', opened)).rejects.toThrow('changed'); expect(remove).not.toHaveBeenCalled();
});
it('marks newly backdated entries as date-only and records their submission separately', async () => {
  await saveJournalEntry('p', { type: 'note', category: 'notes', description: 'Earlier observation', updatedBy: '' }, '2026-09-10', undefined, 'backfill');
  expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ occurrencePrecision: 'date', recordedAt: 'server-time' }));
});
