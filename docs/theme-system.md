# App appearance

All four appearances—Grove, Daylight, Ocean and Dusk—are defined in `design-system/tokens/garden.ts`. `useAppTheme()` returns the selected appearance. Mode is explicit (`mode: 'light' | 'dark'` at runtime); it must never be inferred by comparing a background color with a particular hex string.

## Color roles

| Role | Tokens |
| --- | --- |
| Screen and panels | `background`, `surface`, `elevated` |
| Normal and supporting text | `text`, `muted` |
| Primary actions | `accent`, `onAccent` |
| Watering actions | `water`, `onWater` |
| Destructive actions | `danger`, `onDanger` |
| Highlighted headers | `hero`, `heroText` |
| Outlines and overlays | `border`, `scrim`, `shadow` |

Pair each filled action with its corresponding foreground token. A light header uses `heroText`, even when primary buttons use a light `onAccent`. Success feedback uses the current surface/text pair and an accent icon; a success state does not choose a fixed green panel.

`appThemes()` adapts these same roles to React Native Paper and navigation, including modal/elevation surfaces, errors, outlines and action foregrounds. It also controls the status bar mode. `useThemeDocument` synchronizes browser backgrounds, color scheme, theme-color metadata and CSS variables for focus rings, scrollbars and map controls.

Form components use `useFlowTheme()` and collection controls use `useCollectionTheme()`. These are adapters over the selected theme, not independent palettes. Plant editor controls use `useEditorTheme()`, which honors an explicit editor context and otherwise follows the app. Location components similarly honor an optional explicit theme and default to the app appearance.

The older `useThemeColor`, `useColorScheme` and design-system `useTheme` interfaces also resolve through `useAppTheme`. Legacy design-system Text, Container, Input and Button components therefore use the selected appearance rather than static legacy colors.

Keep colors out of module-level component style definitions. Use a style factory receiving the selected theme, or theme-aware styles in the component. Explicit overrides remain supported for composed editors. Botanical illustrations, growth-stage categories and neutral photo overlays have intentional colors independent of ordinary UI surfaces.

## Fixes and checks

The watering notification previously mixed fixed green panel/action colors with theme-selected text. It now uses `surface`, `border`, `elevated`, `text` and `accent` together. The root light-mode check previously compared against an obsolete hex value; it now uses the explicit mode. Fixed Grove defaults were also removed from loading/error feedback, creation forms, location controls, garden management, draft recovery and editor controls.

Automated coverage includes all four theme adapters; normal text and filled-action contrast of at least 4.5:1; actual notice, form, editor and legacy-input rendering; live appearance changes while feedback remains visible; and a source-boundary check against fixed Grove themes, literal UI colors and static legacy colors returning to components. Existing notification timing, Undo/retry, form validation, navigation and data-mutation tests remain in place.

Browser review covered the theme picker and theme propagation for Daylight, Ocean and Dusk, plus the Daylight home watering dialog. The original Grove appearance was restored after the check. The dialog was closed without saving a watering entry. Native-device appearance has not been visually verified in this pass.

Validation: backend/app type checks, backend build, zero-warning lint, architecture policy, 155 Jest suites / 1,382 tests, web export of 24 static routes and whitespace checks passed. One Firebase integration run stopped with `Transaction is invalid or closed` in the unchanged backend repeating-watering transaction. The complete local Auth/Firestore integration suite passed on a fresh emulator retry; backend behavior was not changed to address that transient run failure.
