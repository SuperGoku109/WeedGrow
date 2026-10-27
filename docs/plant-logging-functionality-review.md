# Plant logging functionality review — 27 October 2026

Review-only pass following the logging presentation changes. No application code or production data was changed.

The findings were subsequently implemented; see [implementation and verification](plant-logging-reliability.md).

## Highest priority

### 1. A changed retry can succeed without saving the new values

**Reproduced using the actual repository with an in-memory Firestore adapter.** Submit a note using a stable request ID, simulate a lost response, change its text, and retry with that ID. The repository returns success while the original description remains stored.

`journalRepository.ts` returns immediately when the target mutation ID matches the request ID (line 44). The composer retains that ID when fields change. Stable IDs correctly protect identical retries, but the code does not distinguish an identical retry from a revised submission. Changing the date or category can also change the target document, which requires reconciliation of the original result before proceeding.

**Improve:** Track the submitted payload with each mutation. Reconcile an uncertain result first. If it committed, load that entry and apply revised values as a conflict-checked edit; if it did not, retry the same payload. Never acknowledge revised content solely because an earlier mutation ID exists.

### 2. Recovered edit drafts do not retain their original conflict baseline

**Source-confirmed gap.** Journal drafts contain the request ID, category, date, description and measurements, but no original entry revision. Recovering an older draft applies its fields over the currently fetched entry. The next save compares against the current entry's mutation ID rather than the revision from which the draft was made, so a newer edit from another device can be overwritten without a conflict.

Evidence: `journalDraft.ts` draft interface; `PlantLogComposer.tsx` recovery handler; `PlantDetailScreen.tsx` edit/save handlers.

**Improve:** Store the original entry revision and a baseline of its editable fields in edit drafts. On recovery, compare with the current record and offer to review differences before applying an outdated draft. Handle deletion of the original entry explicitly.

### 3. A failed draft read can be followed by deleting that draft

**Source-confirmed failure path.** The draft-read catch marks the form ready while leaving `pending` empty. The persistence effect then sees an unchanged empty form and calls `clearJournalDraft`. If reading failed transiently but removal succeeds, unread work can be deleted and the recovery warning cleared.

Evidence: `PlantLogComposer.tsx` draft-read catch (line 60) and persistence effect (line 67).

**Improve:** Separate loading, successfully loaded and failed recovery states. Do not overwrite or clear storage until recovery succeeds or the user explicitly chooses to replace the saved draft. Offer Retry recovery.

## History correctness

### 4. Editing history can change the displayed original time

**Reproduced.** An entry recorded at 14:30 in Africa/Johannesburg was edited after the plant moved to Asia/Tokyo. The timestamp was preserved, but its saved time zone changed to Tokyo; the entry then displayed 21:30.

Evidence: `journalRepository.ts` lines 54–55 retain the old timestamp while assigning the current plant zone.

**Improve:** Preserve the original event's time zone for an unchanged event date/time. Store edit metadata separately. If the user deliberately changes the event date or time, make the interpretation explicit.

### 5. Legacy entries do not receive the same delete-conflict protection

**Reproduced.** A delete opened for an entry without a mutation ID can delete that entry even after another edit gives it a newer mutation ID. The delete check is skipped whenever the expected ID is undefined.

Evidence: `journalRepository.ts` line 66.

**Improve:** Distinguish “no baseline supplied” from “the opened record had no revision.” Compare a real revision or complete baseline for legacy entries as well, and reject the stale delete.

### 6. Backfilled activities display an assumed time as if it were measured

**Source-confirmed presentation limitation.** Saving a past date assigns noon in the plant's zone. Journal presentation displays that timestamp as a normal event time, even though the user selected only a date.

**Improve:** Support an optional occurrence time, or mark date-only entries and suppress the invented clock time. Keep the actual submission time separate from the occurrence date.

## Recovery and task flow

### 7. Successful saves need draft reconciliation when cleanup fails

**Source-confirmed gap.** The parent closes the composer and announces success before the composer clears its draft. Cleanup failures are swallowed. A later visit can offer to resume a draft for an already committed activity.

**Improve:** On opening a draft, reconcile its request ID against saved data before calling it unfinished. If the server save succeeded but local cleanup failed, report “Activity saved; local draft cleanup pending” without suggesting that the save failed or inviting a duplicate submission.

### 8. Contextual logging can remove another decision

**Flow improvement.** Every care-advice action opens the same generic Health form. A button labeled Record soil check does not carry soil-check context or reveal the moisture field. Watering duplicates are also discovered only after submission.

**Improve:** Carry the advice/check type into the composer and focus the relevant input. For dates with known watering history, offer Edit existing watering before the user fills another form. Retain the repository's duplicate checks for concurrency.

## Verification and recommended order

An isolated Node harness transpiled the current repository and used only in-memory records to reproduce findings 1, 4 and 5. No Firebase service was contacted. Findings 2, 3, 6 and 7 follow from the current draft/save code paths; finding 8 is a task-flow improvement.

Recommended order: retry reconciliation; draft baseline and recovery safeguards; historical time preservation and delete conflicts; date-only timestamps; task-specific logging shortcuts. These changes need explicit regression coverage for ambiguous commits, multi-device edits, failed storage reads/removals, legacy records and plant moves.
