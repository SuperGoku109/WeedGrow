# Logging reliability implementation — 27 October 2026

Implements the eight findings in [the functionality review](plant-logging-functionality-review.md).

| Finding | Implemented behavior |
| --- | --- |
| Revised retries | The draft stores the exact attempted payload, destination and mutation ID before a write. An uncertain attempt is acknowledged with its original payload; revised content then becomes a separate edit against the committed entry. The repository rejects a matching request ID with different content instead of returning false success. |
| Stale edit drafts | Edit drafts retain the opened entry revision. Recovery compares it with the current saved record. Conflicts show both versions and require an explicit choice before applying the draft. Deleted originals require an explicit decision to use the draft for a new activity. |
| Failed recovery | Loading, successful recovery and recovery failure are separate states. A failed read cannot trigger automatic overwrite or deletion. Retry recovery and explicit discard remain available. Closing flushes meaningful work first and keeps the form open if that write fails. |
| Historical time zones | Editing an unchanged occurrence date preserves the original event timestamp, precision and time zone. Submission/edit metadata is separate from event time. |
| Legacy deletion | The plant UI passes the complete opened entry as the delete baseline. The repository compares it with the current record, including legacy entries without mutation IDs. An omitted legacy mutation ID no longer bypasses a newly assigned revision. |
| Date-only events | Newly backdated manual entries, dated photos and harvest records carry occurrence precision. The journal displays “Time not recorded” for date-only events. Actual submission time is stored independently. Existing legacy records are not rewritten or assigned inferred precision. |
| Cleanup after success | Saving the journal and clearing its local draft have separate outcomes. Success closes the form only after cleanup is attempted. If cleanup fails, success feedback identifies pending cleanup; the next open checks the stored attempt against its saved record rather than calling a confirmed commit unfinished. |
| Contextual logging | Soil-check advice opens the moisture field directly and saves a health check. Known watering records in the loaded journal range offer Edit existing watering before another form is filled. Selecting that action opens the original entry. The repository still enforces duplicate protection for unloaded dates and concurrent writes. |

## Compatibility

- The draft format remains version 1 with optional revision, context and attempt metadata. Older edit drafts without a revision require explicit review against the current record.
- No new Firestore collection or permission rule is required.
- Backup export/validation/restore support the new precision and submission fields for logs and photos. CSV date-only rows omit an invented clock time; date precision, submission time and event zone columns are appended after the original columns.

## Verification

`npm run verify` passed: TypeScript, lint, architecture checks, **70 suites / 348 tests**, local Firebase integration checks and ownership checks.

New cases cover mismatched retry payloads, revised text after an interrupted save, failed draft recovery, conflict review, committed drafts with failed cleanup, date-only presentation, historical zones, legacy deletion and contextual forms. Local Firebase tests exercise real transactions for identical retries, rejection of revised same-ID payloads, stale edit rejection, reviewed corrections, recovery reconciliation, legacy deletion and timestamp preservation. Backup tests cover the new metadata and CSV behavior.

Browser checks verified the existing-watering shortcut opens the original unchanged entry, and soil-check logging exposes moisture input with a dedicated save label. The original plant journal remains open. No production activities were created, edited or deleted during verification.

Physical-device keyboard, permission and storage-failure behavior still requires native-device validation.
