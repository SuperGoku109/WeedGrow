# Plant Details profile — 27 October 2026

The Details tab now reads as a profile, rather than a stack of edit forms.

## Reading order

1. **Basics:** stage, status, strain, growing age/start date and measured height. Missing age is not inferred from the date the plant was added.
2. **Growing setup:** readable two-column facts, with longer information spanning the card width.
3. **Care routine:** separate watering, feeding, fertilizer and reminder rows. An empty routine gets a short explanation rather than a list of empty fields.
4. **Location:** the saved place name first; coordinates/sensor/time zone and movement history are secondary disclosures.
5. **Notes:** paragraphs with full-note expansion and separate training/pest tags.
6. **Record information:** added/updated dates behind a quiet disclosure.
7. **Manage plant:** archive/restore/harvest controls behind a separate disclosure, retaining their existing confirmations.

Each section has one edit destination, connected to the existing editor. Each card uses Edit as its only action for adding or changing section information; duplicate inline Add prompts were removed. No optional-field count or large setup checklist precedes the saved information.

## Implementation and checks

- Presentation formatting is separated into `plantProfile.ts`; the profile component is separate from weather/advice panels.
- Meaningful zero values remain visible, free-text notes remain intact, invalid legacy time zones fall back safely, and long notes can be read in full.
- Disclosure state survives switching tabs. The movement subscription only runs while its history is expanded and Details is active.
- Grove and Daylight colours use existing semantic tokens. At 320px, the inspected screen had no document overflow or fully visible controls below 44px.
- Full Jest run: 65 suites / 297 tests passed. The daily Journal suite passed again after retaining the Details subtree. TypeScript, lint, architecture and whitespace checks passed.
- Browser review covered both themes, 320/390px layouts, technical/history/record disclosures, management expansion, and disclosure state across tabs. No garden records were created, edited, archived or deleted during verification. Physical-device testing remains pending.
