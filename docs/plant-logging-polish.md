# Plant logging polish — 27 October 2026

Reviewed logging in three passes: entry creation and draft recovery; history and editing; validation, failure feedback and narrow-screen presentation.

## Changes

- Activity choices use readable two-column cards with a short explanation of each type. The selected activity gets a compact identity row and a Change action.
- Watering includes optional quick amounts. Measurement inputs separate their units from the value and show errors beside the affected field. Additional measurements stay collapsed unless they contain data or need correction.
- Shared numeric rules validate the form and repository. Decimal commas and zero values are supported; malformed values are rejected. A health measurement can be recorded without a redundant written observation.
- Recovery shows only Resume / Start new until a choice is made. Restoring a draft does not expand unused fields. Changing activity type keeps entered values and the prior category while the picker is open.
- Draft-only status is explicit. Saving locks the form, duplicate taps submit once, and failed saves preserve values and the stable retry identifier. Duplicate-watering errors explain the next step and offer the day's journal. Draft deletion requires an explicit confirmation.
- Unchanged edits cannot be submitted. Journal cards distinguish saved, updated and search-selected records, display measurements as readable chips, and expand long observations on demand.
- Loading and refresh errors retain visible records and provide retry feedback. Empty days explain how to start.
- Photo records show a preview and open Photos for management. Generated photo, harvest, stage-change and movement records no longer expose a generic delete action that could leave related data inconsistent. Gallery widths also account for the press animation wrapper.
- Entry highlighting no longer repeatedly scrolls the page when its content changes.

## Verification

`npm run verify` passed: TypeScript, lint, architecture boundaries, 69 suites / 325 tests, and the local Firebase integration/ownership checks. After the final layout adjustment, type checking, lint, the 20 focused logging tests and whitespace checks were repeated.

Browser review covered 390px and 320px layouts, Grove and Daylight, existing draft recovery, invalid amount feedback, quick amount correction, discard confirmation, photo journal previews and activity selection. Existing user drafts were retained. The temporary validation draft was discarded; no production journal entries were submitted, edited or deleted.

Native keyboard and device-specific input behavior remain subject to physical-device testing.
