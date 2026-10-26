# Daily Journal — 27 October 2026

## Structure and rationale

Today and Journal were overlapping destinations for the same date-based information. Plant details now has three sections: **Journal, Photos, Details**. Journal opens on the plant's current day and provides one place to browse, read and manage activity.

The reading order is:

1. Plant identity and section navigation.
2. Compact month/calendar control, week navigation, search, and seven-day strip.
3. Collapsed care advice summary, only on today; explanations remain available on demand.
4. Activities actually recorded on the selected day. Empty days use one quiet sentence, with distinct loading/error states.
5. Conditions for that day, labelled as saved history or forecast when appropriate.
6. Persistent Add photo and Add log controls, with the log's target date visible.

This removes placeholder Water/Feed cards, the redundant journal link, duplicate creation shortcuts and the separate Today destination. Entry edit/delete actions sit behind an accessible menu. Search lives in a dedicated sheet and opens a result's recorded day in the main Journal.

## Behaviour and boundaries

- Date navigation is isolated in `useJournalDay`. Today follows the plant's timezone across midnight; explicitly selected history stays fixed. A different plant resets the selection.
- Selection survives moving between Photos, Details and Journal. Calendar/search jumps recenter the week; nearby date selection keeps the strip stable.
- Saving selects the saved day and preserves position when it is already displayed. Midnight is checked again when saving finishes.
- Future days show forecast-only guidance and disable/guard log creation.
- Historical weather remains read-only. Moving the plant does not recalculate previous days. No history migration or billing change was made.
- Shared presentation helpers preserve the entry's saved day and original timezone. Search date validation uses the plant's current day.
- Existing bounded week subscriptions and paged history search are retained. Advice work stops when viewing history or another section.
- A pre-existing invalid rainfall value was found in Zane 3's September 2026 weather history. Existing validation reports the malformed record; this change does not guess values or rewrite it. The subsequent [plant detail refinements](plant-detail-polish.md) isolate this failure to its own day so valid neighbouring records remain visible.

## Verification

- Full Jest run: 61 suites / 286 tests passed.
- TypeScript, ESLint (zero warnings) and architecture boundaries passed.
- Regression coverage includes actual entries, empty states, saved-day navigation, legacy Today links, selected dates across tabs, future logging guards, duplicate sibling identity, midnight/timezones and plant-day search validation.
- Browser checks cover 320, 390 and 430 pixel mobile widths, Grove/Daylight themes, calendar selection, care disclosure, past/future days, and search opening an existing watering entry without creating/deleting records.
- At 320px, the reviewed screen had no document overflow or fully visible interactive targets below 44px. The date strip intentionally scrolls horizontally.
- Physical-device testing remains pending. The user's existing composer draft was not discarded.
