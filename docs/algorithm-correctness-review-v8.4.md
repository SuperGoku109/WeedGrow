# Hops algorithm and plant-care correctness review

For subsequent production hardening and the latest passing full verification, see [Production readiness](production-readiness-v8.4.md). This report retains the results of the earlier correctness review.

Reviewed on 5 November 2026 against the supplied v8.4 handoff, its canonical/boundary rules, the implementation and actual care consumers. This review found defects in the first implementation and fixed them. Passing tests are not a claim that all 28 handoff tasks or real-plant validation are complete.

## Defects fixed

1. **False weather all-clears.** A declared coverage list could clear flower/wet-canopy context without any rain records. Invalid humidity bins could also be discarded while leaving complete coverage asserted. `warningEvidence.ts` now checks actual records, quality, compatible support, source identity, revisions, overlaps and interval continuity. Unsupported means cannot clear point-temperature screens. Supported positive evidence still survives unrelated gaps.
2. **Rain conflicts depended on input order.** Last-duplicate selection could hide a positive rain integral or produce a flower-context warning from an unresolved revision. Conflicting revisions now make the affected evidence unknown, with stable results in either input order. Genuine identical retries remain deduplicated.
3. **Unknown stages were treated as known nonflowering.** Empty/unrecognized stages now remain unknown for flower/establishment context.
4. **As-of and phase boundaries.** Evaluation now rejects warning windows inconsistent with the requested current/forecast boundary. It preserves a revision's original availability when that same immutable record is later refetched; later retrieval alone no longer makes previously available evidence unavailable. A new correction still requires its own real first availability.
5. **Mixed integral paths.** The integral helper could join different variables or providers end-to-end and call their sum complete. It now rejects mixed paths before integration.
6. **Water-bank arithmetic and invalid states.** Computing reserve by subtracting a large overflow caused cancellation error. The update now computes inside the bounded bank. Invalid/inverted saved reserve bounds cannot yield a definite decision or pass refill/transition operations. Nonboolean anchor/reception flags are rejected.
7. **Event deletion coercion.** A string deletion flag could erase a real watering event. Latest authoritative records now validate deletion and amount/timing shape before selection; string flags cannot become tombstones.
8. **Projection gaps and sheltered rain.** Forecast steps now require explicit start/end times, continuity, common state time, a valid horizon and nonnegative finite forcing. Invalid paths return unavailable rather than throwing. Explicit rain reception prevents a sheltered root zone receiving forecast water. Horizon censoring remains null at the upper end.
9. **Inactive shadow care.** Archived/deleting plants are blocked in water replay itself, including shadow evaluation.
10. **Incomplete delivery gates.** Checking only the values present in a policy allowed an empty policy to pass validation. Every named permission/policy gate must now be a boolean. No notifications are sent by the algorithm helper.
11. **Consumer validity differed between screens.** The home watering list relied on weather acquisition age and a legacy boolean. It now shares version/shape/expiry checks with the care-card path. Inconsistent decisions, future/invalid evaluations, unversioned results and expired estimates cannot become actionable. A definite decision requires a profile version and an explicit validity end; no general model lifetime was invented.
12. **History-read outages disappeared from care.** Failure to read logs/weather now retains an unavailable result for an active plant. Empty care output no longer says “No care alerts.” Unavailable cards no longer describe themselves as weather-based estimates; expired cards drop old actionable copy/reasons.
13. **Plant day versus device day.** Care history queries and current-weather matching now use the plant's timezone. A regression covers a plant whose calendar day differs from the device day.
14. **Routine reminders.** Deleting plants receive no tasks/subscriptions; future logs do not complete care or postpone routines. An explicit watering reminder setting of `none` no longer falls back to the watering frequency. Device notification copy identifies a user-set routine rather than asserting measured water/feeding need. Tests verify cancellation, plant-local weekdays/times, unique IDs and the delivery bound.
15. **Invalid provider request inputs.** Invalid coordinates cannot trigger weather fetching, and adapters reject unknown product names instead of classifying them as a supported product.

## Verification evidence

- Added adverse cases before fixing the core: 15 of the initial 16 audit tests failed against the first implementation, reproducing the defects. All now pass; positive complete-coverage tests also ensure the fixes do not force every warning to remain unknown.
- Full Jest run: **98 suites, 543 tests passed**. This includes 26 tests added during this review, the 13 unchanged synthetic bank oracles, randomized conservation checks, existing journal/UI tests and clearly identified historical comparison suites.
- Package verifier: **passed**, including 243 reference methods, manifest integrity and 1,652 captured canonical samples. Its reference outputs/expected answers were not changed to fit the TypeScript implementation.
- App TypeScript, backend TypeScript/build, targeted ESLint on changed code, architecture policy and whitespace checks: **passed**.
- Local Firebase Auth/Firestore integration with pinned CLI **15.5.1**, demo project `demo-weedgrow`: **passed**. This exercises concurrent watering/save retry, correction/undo, batch care, ownership/actor checks, deletion barriers, care summaries and snoozes, plus existing plant/weather workflows. Emulators shut down successfully afterward.
- `npm run verify`: backend types/build and app types passed, then stopped at **97 existing lint errors and 5 warnings** in unrelated audit/vendor files under `output` and `tmp`. The integration stage was therefore run separately. Those unrelated files were not modified to hide the lint failure.

## What remains unverified or incomplete

Automatic water recommendations still return null in the real app: the adapter has no approved hops profile, state anchor or connected canonical history feed. Live provider policy/storage/backfill, full setup/transition persistence, all weather-warning UI routes, notification episode persistence and field-data workflows remain unfinished as listed in `algorithm-implementation-status-v8.4.md`. No source feed, calibrated profile or predictive disease model was activated.

The review verifies tested algorithm behavior and local care/log/reminder integration. It does not establish actual hops watering accuracy, provider uptime or visual/physical-device notification delivery. Genuine low-input calibration, independent outcomes and the remaining end-to-end integrations are still required before production watering activation.
