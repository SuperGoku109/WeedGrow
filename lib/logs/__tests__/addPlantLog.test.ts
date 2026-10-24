import { addPlantLog } from '../addPlantLog';
import { saveJournalEntry } from '../journalRepository';
jest.mock('../journalRepository', () => ({ saveJournalEntry: jest.fn() }));
it('propagates save errors without reporting a successful log', async () => {
  jest.mocked(saveJournalEntry).mockRejectedValueOnce(new Error('Offline'));
  await expect(addPlantLog('p', { type: 'note', updatedBy: '' }, '2026-09-10')).rejects.toThrow('Offline');
});
