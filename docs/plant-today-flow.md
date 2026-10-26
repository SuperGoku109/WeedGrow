# Plant Today flow — 26 October 2026

Superseded by [Daily Journal](daily-journal-design.md): Today and Journal are now one date-based section. This document records the preceding design.

Today is now a read-only summary of care advice, actual records for the plant's current calendar day and current conditions. Activity creation stays in the fixed bottom Add log and Add photo controls.

- Removed unconditional Water/Feed tiles and their “Not recorded today” states.
- Replaced the large empty activity card with one quiet line, “Nothing recorded today.” Loading and read failures remain distinct from an empty day.
- Actual records appear once in the timeline, including every record returned for today rather than silently showing only the first three.
- Removed the View full journal link; Journal remains directly available in the section tabs.
- Removed duplicate in-advice logging shortcuts. Advice explanations remain expandable; the bottom bar supplies creation actions.
- Today’s timeline is read-only. Editing/deletion remain in Journal.
- Saving today’s activity from Today keeps that tab and its scroll position. Saving an earlier date opens that date in Journal. The destination uses the current plant day when the save completes, so an entry that becomes historical across midnight is shown in Journal.
- Journal’s existing full timeline, calendar, search and management controls are retained. No care, plant or weather records were rewritten by this UI change.

## Checks

Screen-level regression tests cover the empty summary, fixed creation actions, four actual records without truncation or duplicate controls, current-day versus past-date save destinations, and a date becoming historical while the composer is open. They mock persistence and do not write to the real garden.

Browser inspection at 390 × 844 confirmed the simplified empty state, removed shortcuts and fixed footer. Add log still opens the existing composer; it was closed without saving or discarding the user's unfinished draft. Sampled text contrast and fully visible target sizes passed the existing browser check. Physical-device testing remains pending.
