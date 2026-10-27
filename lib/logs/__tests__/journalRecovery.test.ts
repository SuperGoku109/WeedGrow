import { inspectJournalDraft } from '../journalRecovery';
import { readJournalEntry } from '../journalRepository';
import { journalPayload, journalRevision } from '../journalMutation';
import type { JournalDraft } from '../journalDraft';
import type { JournalEntry } from '../journalRepository';
jest.mock('../journalRepository', () => ({ readJournalEntry: jest.fn() }));
const entry = { id: 'entry', type: 'note', category: 'notes', description: 'Saved', calendarDay: '2026-10-26', updatedBy: 'owner', mutationId: 'request', timestamp: { toDate: () => new Date('2026-10-26T12:00:00Z') } } as JournalEntry;
const input = { type: 'note', category: 'notes', description: 'Saved', updatedBy: '' } as const;
const draft: JournalDraft = { version: 1, requestId: 'request', category: 'notes', date: '2026-10-26', description: 'Saved', measurements: {} };
it('recognizes a committed draft rather than offering it as unfinished', async () => {
  jest.mocked(readJournalEntry).mockResolvedValue(entry);
  const attempted = { ...draft, attempt: { requestId: 'request', targetId: 'entry', date: draft.date, input } };
  expect(await inspectJournalDraft('plant', attempted, journalPayload(input, draft.date))).toMatchObject({ kind: 'saved', confirmedAttempt: true });
});
it('turns revised content after a committed attempt into an edit of that saved entry', async () => {
  jest.mocked(readJournalEntry).mockResolvedValue(entry);
  const attempted = { ...draft, attempt: { requestId: 'request', targetId: 'entry', date: draft.date, input } };
  expect(await inspectJournalDraft('plant', attempted, journalPayload({ ...input, description: 'Revised' }, draft.date))).toMatchObject({ kind: 'ready', confirmedAttempt: true, entry });
});
it('requires review when a recovered draft baseline differs from the current record', async () => {
  jest.mocked(readJournalEntry).mockResolvedValue({ ...entry, description: 'Changed elsewhere', mutationId: 'newer' });
  expect(await inspectJournalDraft('plant', { ...draft, entryId: entry.id, entryBaseline: journalRevision(entry) })).toMatchObject({ kind: 'conflict' });
});
it('requires review for old edit drafts that have no conflict baseline', async () => {
  jest.mocked(readJournalEntry).mockResolvedValue(entry);
  expect(await inspectJournalDraft('plant', draft, undefined, entry.id)).toMatchObject({ kind: 'conflict' });
});
it('does not silently recreate a deleted original entry', async () => {
  jest.mocked(readJournalEntry).mockResolvedValue(null);
  expect(await inspectJournalDraft('plant', { ...draft, entryId: 'deleted', entryBaseline: 'old' })).toEqual({ kind: 'deleted' });
});
it('propagates a failed read so the composer cannot clear an unread draft', async () => {
  jest.mocked(readJournalEntry).mockRejectedValue(new Error('Offline'));
  await expect(inspectJournalDraft('plant', { ...draft, entryId: 'entry' })).rejects.toThrow('Offline');
});
