import { waterPlants } from '../bulkWatering';
import { saveJournalEntry } from '../journalRepository';
import type { Plant } from '@/firestoreModels';

jest.mock('../journalRepository', () => ({ saveJournalEntry: jest.fn() }));
const plant = (id: string, status = 'active', deleting = false) => ({ id, status, deleting } as Plant & { id: string });
beforeEach(() => { jest.resetAllMocks(); jest.mocked(saveJournalEntry).mockResolvedValue({ id: 'watering_today', mutationId: 'request' }); });

it('waters each active plant once across gardens, excluding inactive and deleting plants', async () => {
  expect(await waterPlants([plant('one'), plant('two'), plant('one'), plant('past', 'harvested'), plant('deleting', 'active', true)])).toEqual({ written: 2, skipped: 0, failed: 0 });
  expect(jest.mocked(saveJournalEntry).mock.calls.map(call => call[0])).toEqual(['one', 'two']);
});
it('skips daily duplicates and reports partial failures without abandoning other plants', async () => {
  jest.mocked(saveJournalEntry).mockImplementation(async id => {
    if (id === 'already') throw new Error('Watering already logged for this day.');
    if (id === 'offline') throw new Error('Offline');
    return { id: 'watering_today', mutationId: 'request' };
  });
  expect(await waterPlants([plant('already'), plant('offline'), plant('new')])).toEqual({ written: 1, skipped: 1, failed: 1 });
});
it('accepts an empty scope without writing', async () => {
  expect(await waterPlants([])).toEqual({ written: 0, skipped: 0, failed: 0 });
  expect(saveJournalEntry).not.toHaveBeenCalled();
});
