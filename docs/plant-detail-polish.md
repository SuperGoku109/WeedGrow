# Plant detail refinements — 27 October 2026

Date-navigation update: the user subsequently chose a single seven-day row. The 7/14-day setting and its persistence hook were removed. The full-month picker now has direct year entry and year arrows. All date selection and search are bounded by the plant’s added day; earlier calendar dates and backward navigation at the boundary are disabled. Historical records are unchanged. Items 1–4 below record the preceding review implementation.

The review's fourteen items are implemented in the existing Grove/Daylight design system:

1. A remembered 7/14-day choice, with fourteen days arranged as two rows.
2. Evenly distributed date cards that fill the available width. Below the space needed for seven accessible targets, the grid scrolls horizontally and keeps the selected column visible.
3. An explicit visible date range, separate from the full-calendar control.
4. Default date ranges end on today. Next/previous controls move by the chosen range; future forecast browsing remains available.
5. Recorded activity counts and dots on loaded days, with entry counts/loading/error information in accessible date labels.
6. A smaller 80 × 92 cover and tighter banner spacing, retaining long-name handling and readable badges.
7. Individually labelled current temperature/humidity/rain, a single location label, and freshness beside refresh.
8. Uncertain watering advice is presented as a soil check. Confirmed risk severities remain intact, and the most severe alert leads the summary.
9. Explicit loaded-history filtering, pagination feedback, and search text/category/date filters retained while closing and reopening the sheet.
10. Stable half-width photo thumbnails, including when only one photo exists; singular/plural counts and initial loading copy are corrected.
11. Readable stage/status/environment labels and place names in Details. Coordinates remain available inside the location group.
12. Useful optional additions replace the completion count. Each addition opens its relevant editor.
13. Separate reading positions for Journal, Photos and Details, restored after initial content is ready. Focus movement on sticky web tabs is excluded from the saved outgoing position.
14. Weather documents decode independently. A bad day's record has its own error, while valid neighbouring days remain readable; source records are never rewritten.

Location movement history also now uses the chosen theme rather than hardcoded dark-theme colours. Historical weather remains read-only, future log creation remains guarded, and fixed bottom creation actions stay available.

Automated regression coverage checks range changes and calendar boundaries, late preference reads, date-scoped weather failures, and uncertainty-aware advice alongside the existing daily Journal flow. Browser review uses phone widths and existing garden records without creating or deleting entries. Physical-device checks remain pending.

Validation: 63 Jest suites / 291 tests passed; the daily Journal suite passed again after the final scroll changes. TypeScript, ESLint with zero warnings, architecture boundaries and whitespace checks passed. Browser checks confirmed the remembered fourteen-day choice after reload, retained search filters, the damaged historical day's isolated error, readable themes at 320/390px, and the fixed footer.
