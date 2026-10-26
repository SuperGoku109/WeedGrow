# Mobile UI review — 26 October 2026

Review method: three passes (task flow and hierarchy; readability and controls; regression at 320, 390 and 430 CSS pixels). Main phone viewport: 390 × 844. Each item below addresses an observed layout issue or a concrete issue in the active screen code.

## Implementation checklist

- [x] Replace the tall phone home marketing hero with a compact garden identity and add action.
- [x] Prevent the hero illustration overlapping text on small screens.
- [x] Reduce header overhead so useful garden content appears sooner.
- [x] Keep plant-status filters in one horizontally scrollable row.
- [x] Give selected filters a filled state and checkmark, beyond text color alone.
- [x] Remove doubled horizontal margins in the home list header.
- [x] Keep all three overview counts in a balanced phone row.
- [x] Collapse recent activity until requested, preserving its links.
- [x] Put a clearly labelled care-checklist action in the overview.
- [x] Add an explicit clear-filters recovery action to empty search results.
- [x] Give plant cards a separate detail target and watering target.
- [x] Reduce oversized plant thumbnails that squeeze names.
- [x] Make watering status readable and announce the plant name in action labels.
- [x] Replace the faint add-plant footer with a clear outlined action.
- [x] Increase bottom-navigation labels and distinguish the selected destination.
- [x] Respect the bottom safe area in the main navigation.
- [x] Use measured semantic text/control color pairs in both plant themes.
- [x] Increase essential input, helper and metadata text sizes.
- [x] Use 48-point targets in shared controls.
- [x] Remove the wasted edit-only row above each plant detail accordion.
- [x] Simplify the narrow plant toolbar and preserve its actions.
- [x] Give dialog confirmation and cancellation distinct visual priority; allow long labels to wrap.
- [x] Shorten the phone profile hero so saved profiles appear sooner.
- [x] Increase tiny profile metadata and reading labels.
- [x] Keep profile actions usable when they wrap on small phones.
- [x] Group settings into recognizable, labelled navigation rows with icons and chevrons.
- [x] Put preferences and backups in separate visual sections.
- [x] Make the default-environment choice visibly selected and accessible.
- [x] Move lengthy backup explanation into optional help, preserving limits and restore semantics.
- [x] Show task progress near backup actions rather than far away.
- [x] Give journal search persistent labels instead of placeholder-only fields.
- [x] Collapse optional date filters so journal entries remain prominent.
- [x] Use a single scrollable category row and a prominent journal search action.
- [x] Improve care-page heading, task actions and empty-state hierarchy.
- [x] Improve location input size, feedback readability and secondary action targets.
- [x] Make add-plant header/footer adapt to narrow widths and long action text.
- [x] Reduce nonessential entrance animation delays for ordinary navigation.
- [x] Check narrow-screen overflow, selected states, keyboard focus and text contrast after implementation.
- [x] Keep the plant inventory ahead of secondary overview and care-advice content.
- [x] Distinguish an unsearched journal from a completed search with zero results.
- [x] Enlarge the web map’s 30-pixel zoom controls and pin hit area, with a visible keyboard focus outline.
- [x] Stop partial cached detail records briefly appearing as the complete garden count; provide retry feedback if the inventory cannot be confirmed.

## Design references

- [W3C: minimum contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal text 4.5:1; large text 3:1. Check foreground/background pairs, including placeholders.
- [Android: app accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps): recommend 48 × 48 dp touch areas, descriptive controls and sufficient contrast.
- [Material: color roles](https://m3.material.io/m3/pages/color-roles?s=m3): pair semantic foreground and surface roles consistently.

This is browser responsive-layout testing, not certification of full WCAG conformance or physical-device keyboard/screen-reader behavior. No production garden changes, billing changes or service upgrades are part of the UI review.

## Completed passes and verification

All **42 checklist items** above were implemented. The later loading pass also changed pending profile counts from zero to a dash, matching the garden count behavior.

1. **390 × 844 baseline:** inspected Home, plant details, add plant, profiles and settings. Found wrapped filters, hero/text overlap, excessive overview/history above the inventory, tiny navigation/profile metadata and flat settings hierarchy.
2. **Implementation review:** moved secondary overview/advice below the plant inventory, condensed mobile heroes, rebuilt card targets, grouped settings, improved typography/control roles, and checked journal/date filters. The first plant now appears in the initial phone viewport.
3. **320 × 740 and 430 × 932 regression:** checked narrow home/profile/settings layouts, dark and daylight plant details, section editor/map, care checklist and all five add-plant steps. Resumed the temporary draft after a rebuild, checked the long review action at 320 pixels, then discarded the review-only draft without creating a plant.

### Checks

- **npm run verify passed:** TypeScript, lint, architecture boundaries, **57 suites / 270 tests**, plus Firebase Auth/Firestore emulator functional and ownership checks. Emulators use the demo project and were stopped afterward. Final presentation-only edits were type/lint checked again.
- New contrast guards cover all supported text, muted, accent, water, warning and danger foregrounds on background/surface/elevated tokens in both plant themes (minimum 4.5:1), on-accent and hero text, input boundaries (3:1), and the shared 48-point target.
- Read-only browser measurements checked rendered text and fully visible controls. Home, profiles, tools, journal, care, add-plant setup/review/location and both plant-detail themes had no remaining failures in the inspected states. Two profile status labels were darkened after a measured 4.07:1 result. Map zoom targets measured 48 × 49 CSS pixels after the change.
- No document horizontal overflow was detected at the inspected 320, 390 and 430 widths. Horizontal filter strips intentionally scroll within the screen.
- Keyboard Tab navigation reached the intended next settings row. Its original dark browser outline was hard to distinguish; a two-tone web focus ring now remains visible on both garden themes.
- Journal search returned 14 existing entries and four matches for Gia. Empty plant search successfully cleared its filters. The garden returned to four plants and one space after the draft walkthrough.
- The cached-inventory fix has a regression test: a cached detail-only snapshot cannot replace the complete inventory, a 15-second connection wait produces retry feedback, and a subsequent server snapshot recovers.

### Limits

Browser checks do not verify real-device keyboard resizing, physical GPS, native notifications, OS font scaling, screen readers, or every possible long-content state. Native map zoom styling was aligned, but physical-device verification remains pending. Automated contrast measurements sample ordinary text and backgrounds; they are not a full accessibility audit of every map tile, image, overlay or disabled state. No measured performance-speedup claim is made.

The app is running at http://localhost:8081 and the preview is left at **390 × 844** as requested.

### Screenshots

- [Home](../.codex-mobile-home-390.png)
- [Profiles](../.codex-mobile-profiles-390.png)
- [Garden tools](../.codex-mobile-tools-390.png)
