import { readJournalEntry, type JournalEntry } from './journalRepository';
import { journalEntryPayload, journalPayload, journalRevision } from './journalMutation';
import type { JournalDraft } from './journalDraft';
export type JournalRecovery = { kind: 'ready' | 'saved' | 'conflict' | 'deleted'; entry?: JournalEntry; confirmedAttempt?: boolean };

export async function inspectJournalDraft(plantId: string, draft: JournalDraft, currentPayload?: string, fallbackEntryId?: string): Promise<JournalRecovery> {
  if (draft.attempt) {
    const target = await readJournalEntry(plantId, draft.attempt.targetId);
    if (target) {
      if (target.mutationId === draft.attempt.requestId && journalEntryPayload(target) === journalPayload(draft.attempt.input, draft.attempt.date)) {
        return { kind: currentPayload === journalEntryPayload(target) ? 'saved' : 'ready', entry: target, confirmedAttempt: true };
      }
      // An uncommitted same-document edit still has its original baseline.
      if (target.id === draft.attempt.sourceId && journalRevision(target) === draft.attempt.baseline) return { kind: 'ready', entry: target };
      return { kind: 'conflict', entry: target };
    }
  }
  const sourceId = draft.attempt?.sourceId || draft.entryId || fallbackEntryId;
  if (!sourceId) return { kind: 'ready' };
  const entry = await readJournalEntry(plantId, sourceId);
  if (!entry) return { kind: 'deleted' };
  const baseline = draft.attempt?.baseline || draft.entryBaseline;
  return { kind: baseline && journalRevision(entry) === baseline ? 'ready' : 'conflict', entry };
}
