# Design consistency review — 24 October 2026

This review follows the performance review and focuses on consistent domain rules, write boundaries and derived information. Existing uncommitted work is preserved. No production migration, billing change, security-rule deployment or new service is involved.

## Changes completed

1. **Enforce growing-space capacity when creating plants.** Previously the space editor enforced a maximum while the add-plant transaction could append another member to a full space. A shared policy now defines the limit and both mutation paths enforce it. The add-plant check runs against the group read in its transaction, so concurrent additions cannot bypass the check. The atomic watering limit also has one definition shared by its service and confirmation message.
2. **Write only changed group members.** Saving group settings previously updated every member's `updatedAt`, including plants with independent locations. Membership changes, inherited pin changes and inherited label changes now determine which plants need writes. Real moves still record their movement and preserve historical weather. No-op member updates no longer produce misleading timestamps or unnecessary listener updates.
3. **Clear care snoozes consistently.** An individual watering clears its watering snooze. Group watering now does the same, in the same transaction as the care record, while preserving feeding snoozes. Skipped, inactive and already-recorded plants remain untouched.
4. **Use one age calculation.** Plant age labels and group averages now derive age from the start date using each plant's local calendar day. Group averages previously used a recorded number that became stale. Unknown, impossible and future ages are excluded; legacy records without start dates retain their explicitly recorded age.
5. **Keep saving code out of screen hooks.** Plant/group mutation services now import stream recovery from the shared data service. Screen hooks remain adapters for UI consumers. Successful writes still rely on live updates; failed streams alone reconnect.

## Evidence

- 43 Jest suites / 232 tests passed, including full-space rejection before writes, leap-day/local-day ages and invalid/unknown-age handling.
- TypeScript and lint passed.
- The local Firebase workflow check passed. Added assertions confirm group-only setting changes leave member records byte-for-byte unchanged and group care clears only the watering snooze. Existing checks still cover concurrent watering, atomic retries, membership moves, stale edit conflicts, deletion guards and historical-weather preservation.
- Tests use disposable local Firebase data. Existing production plants were not modified for this review.

## Further work to consider

These are separate, unimplemented changes, rather than claims that the app now has no remaining design issues:

- Consolidate create/edit validation into shared field policies, preserving compatibility for existing records and making field-specific errors consistent.
- Add bounded pagination/aggregation for large gardens, journal exports and deletion cleanup; the present garden data layer still loads all owned plant/group records.
- Further standardize calendar-day metadata for setup and harvest activities, so an explicit date keeps the same meaning across device and plant timezones.
- Consolidate repeated visual loading/error components and shared theme values across older screens.
- Complete physical-device checks for GPS, native navigation, notification permissions and notification delivery.

These improvements should be implemented with focused tests and migration decisions where needed, rather than a broad rewrite.

The subsequent [coding-standards review](./coding-standards-review.md) completes shared core field validation, explicit setup/harvest calendar days, bounded deletion cleanup and shared initial loading/journal retry behavior. Its remaining-scope section records the parts still outstanding.
