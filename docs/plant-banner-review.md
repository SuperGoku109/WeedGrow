# Plant profile banner — 26 October 2026

Implemented the agreed banner direction in `features/plants/components/PlantBanner.tsx`, replacing the old inline identity row. Presentation changes only; plant records, care history and weather rules are unchanged.

- One rounded surface groups the cover, plant name, optional known strain, growth-stage and status badges, environment/place and Edit action.
- Covers use a 96 × 112 frame with proportional cropping. A local botanical SVG supplies the image-free state; missing or failed images have a fallback and stored covers have loading feedback.
- The name is the strongest text. Missing strain copy stays in Details rather than adding noise to the header.
- Edit lives in the banner and opens the same full editor for that plant. The top bar now contains Garden navigation and the theme switch.
- The section tabs form the bottom of the banner. Once pinned, the rail gains its own rounded top corners and border, avoiding an open-looking outline after the photo has scrolled away. Scroll events update state only when crossing that threshold.
- At phone widths, long names receive a full-width heading instead of being squeezed beside the cover. Metadata can wrap and the component has no fixed overall height.
- Colors use the existing contrast-tested dark/daylight theme roles; text never overlays a user image. Edit and section targets remain at least 48 points.

## Iterations and checks

1. Inspected the first composition at 390 and 320 pixels. Removed the unnecessary profile eyebrow and increased name prominence without increasing the ordinary banner's height.
2. Checked daylight colors, tab navigation and scrolling. Refined the sticky rail to appear complete when detached from the banner.
3. Opened a real image-free plant with a known strain and confirmed its botanical fallback. The banner Edit action opened the correct full editor; it was closed without saving.
4. Used a temporary local preview of the actual component to test long names, long strain/place text, archived/harvested badges and an unbroken long name at 320 pixels. The first title occupied a narrow 138-pixel column and 190 pixels of height. The revised title uses 250 pixels and 64 pixels of height. No horizontal document overflow was detected. The temporary preview route was removed after review.
5. Inspected rendered contrast and targets in both themes: no failures in the sampled banner states. Full OS font scaling and physical-device screen readers remain outside browser-only testing.

TypeScript, lint and the existing 57-suite / 270-test run passed during implementation. Final responsive and sticky-rail refinements passed TypeScript, lint and architecture checks again. The final 320, 390 and 430 layouts had no detected document overflow; final preview checks reported no new console errors. No production plant/profile/care records were edited during the walkthrough.

The app remains running locally. Final preview: 390 × 844.
