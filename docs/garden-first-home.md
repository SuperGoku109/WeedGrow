# Garden-first Home: initial UI implementation

Implemented 27 October 2026 as a focused slice of the [broader design spec](garden-first-design-spec.md).

## Included

- Home opens on a garden's plants, without the Groups / Plants swipe tabs.
- A compact cream garden header retains the existing Grove visual language and opens an anchored dropdown.
- The dropdown switches gardens, remembers an explicit selection per account/device, provides All plants for legacy/unassigned records, and offers garden creation.
- Garden creation requires a name, environment and valid location pin. Search, device location, map selection, manual coordinates and copied garden pins use the existing location picker. Stable request IDs protect retries.
- Home shows active plants directly, without Active / Past tabs. Past plants is a secondary option in the garden action menu (or collection options when viewing All plants). History has Archived, Harvested and Dead refinements and a Back to plants action. Journal/photos/details and bottom navigation are retained.
- Add plant carries the selected garden into the existing five-step flow and prefills its shared setup. Resuming an older draft retains that draft's garden.
- The garden header's action menu opens focused Garden settings, Manage plants, or Log garden watering. The large tools card below the list has been removed.

## Refinement pass

All nine agreed improvements have been implemented:

1. Shorter cream header, retaining the garden dropdown and a separate accessible action menu.
2. Active plants form the default list. Past plants is tucked into the action menu, with history controls visible only when browsing past plants. This supersedes the initial Active / Past segmented control.
3. Settings, management and garden watering available beside the garden name.
4. Cards show strain and known age; the environment is omitted inside a garden. Unknown ages are not inferred.
5. Quick watering opens an optional amount/notes form, with an explicit Save watering action, captured date, stable retry ID and guarded Undo.
6. A quiet, garden-scoped care link appears when checks are due or care data has failed. Empty setup prompts and routine-loading text no longer occupy the default Home. Its checklist destination names the same garden; routines and the full checklist remain available through plant Details and More.
7. Each plant's menu exposes Move to garden. The picker previews inherited/custom settings and environment transitions. The repository commits forward/reverse membership and movement history together, revalidates concurrent changes and preserves previous weather.
8. Per-account, per-garden session memory retains search, detailed status and scroll position when switching or returning from a plant. Scroll events update only position, so a late event cannot revert a newer filter. Garden selection remains persisted on the device.
9. Older management, creation, location and plant-navigation surfaces use garden terminology. Add plant creates a new plant with garden context; Move existing plants is a separate action.

## Deliberately deferred

No existing plants are reassigned automatically. Required garden membership, storage/rules migration, shared-setting inheritance changes, active/history capacity changes, bulk feeding/resumable batches, four-step creation, and Home / Care / More navigation remain proposals in the broader spec.

All plants remains an explicitly labelled compatibility browse option. Existing storage uses groups/groupId internally. The current 80-member garden capacity and eight-member garden-watering limits still apply; this pass does not implement the broader active/history capacity migration or large bulk operations.

## Verification

- TypeScript, ESLint with zero warnings, architecture checks, and whitespace checks passed.
- Full Jest run: 76 suites / 359 tests passed. Added coverage includes explicit watering confirmation, unknown amounts/retry identity, past status/age presentation, account-separated view memory, and late scroll events preserving changed filters, alongside the earlier garden/draft tests.
- Browser review covered desktop, 320 px and 390 px mobile widths; dropdown selection and persistence after reload; scoped search/empty results; existing plant navigation and return; Add Plant entry context; and garden creation form layout.
- Browser review additionally covered garden action/settings menus, the watering form, past filters/empty state, scoped care, an unassigned plant's move preview, and actual scroll restoration after garden switching and returning from a plant.
- The actual move repository passed `scripts/test-garden-moves.cjs` against local Auth/Firestore emulators and existing rules: concurrent moves, lost-response retry, source cleanup, keeping custom settings, cross-environment movement, changed destination previews, capacity/deleting guards, and byte-for-byte historical weather preservation.
- The existing `scripts/test-functional-workflows.cjs` local database checks also passed, including logging, membership, backup/restore, photo, harvest and profile concurrency checks.
- Browser inspection did not save plants, care records, new gardens or moves. Write testing used disposable local-only demo-project records. Native end-to-end save behavior is not claimed.
- Native device keyboard/back behavior remains to be checked on a physical device.


## Garden weather collection

New gardens must have valid coordinates in both creation entry points. Legacy gardens remain readable and editable without a migration. Empty gardens can collect weather independently of plants: `groups/{gardenId}/weatherCache/{date}` stores daily observations and forecasts, and `groups/{gardenId}.currentWeather` stores the latest conditions. History belongs to the garden owner and is protected by the matching Firestore rules.

Home starts collection for pinned gardens when they appear, checks again every 15 minutes and on foreground resume, and reuses current data for up to six hours (or until the local day/pin changes). Concurrent requests are shared. Failed requests show a retry action without undoing garden creation. Responses recheck ownership and coordinates in a transaction, preserve previous same-day locations, and leave past dates and plant history untouched. Indoor gardens collect outdoor context at their pin; sensor profiles still describe indoor conditions.

Collection is client-driven. There is no scheduled backend collection while the app is closed. Firestore rules for the garden weather subcollection must be deployed with this change.


## Mobile garden creation refinement

The Home creation form uses the existing editor bottom sheet with a pinned, full-width Create garden button. It asks only for name, environment (dropdown), and location. The location picker starts with search and device location; secondary options contain existing garden locations (deduplicated by coordinates), map selection, coordinates and location-use information. A selected location collapses to a single Change row. Repeated headings, success notices, empty-pin reminders and plant-specific copying instructions are omitted in this form. Other location editors retain their full controls. Browser checks covered the 390 px form, search/select/change, and scrolling secondary options at 320 px; no new garden was saved during UI review.


## Dismissal controls

Dismissible overlays share `ui/CloseButton.tsx`: a top-right � icon, a 48 � 48 target with extra hit area, contextual accessibility labels, pressed feedback and a disabled state. Applied to editor sheets, garden selector/settings, photo viewer, selection/calendar pickers, enlarged map, sensor dialogs, Add Plant overlays, shared action dialogs and delete confirmations. Form actions such as Cancel and Save remain text-labelled. Existing discard guards and saving locks remain in place; the calendar closes its year menu too. Mobile browser review checked garden creation, plant editor, calendar and watering dismissal without saving data. TypeScript, full ESLint, architecture checks and all 77 Jest suites / 368 tests passed.


## Compact Add Plant controls

Add Plant uses compact single-field selectors for growth stage, garden, environment, strain type, pot size, sunlight, sensor profile, soil/protection and routine frequency. Their option lists expand directly beneath the field within the form, including inside expandable sections. Long lists scroll within the attached menu. Tapping the field again, choosing an option or pressing Android Back closes the menu. Selected values stay visible; lists longer than seven options can be searched. Optional selectors include an explicit unspecified option, and pot size exposes a custom input only when requested.

Two or three short, closely related options use segmented rows (pot/ground and age entry mode). Multi-select pest/training tags remain visible chips. Optional strain, soil, care, history and location nickname sections are collapsed unless existing values or validation need them. Photos have a single initial action, with change/remove after selection. The location step uses the compact picker and a short garden-follow summary. The existing five steps, draft recovery, validation, journal effects and persistence stay unchanged.

Browser review covered the setup, location and details steps; custom pot-size entry and resetting unspecified; a routine selector inside a disclosure; draft recovery after hot reload; and 320 px / 390 px layout. The existing draft was retained and no plant was submitted. Native keyboard behavior remains a device check.


## Plant location step clarification

Step three is titled Plant location, with the purpose Used for local outdoor weather. A plant assigned to a garden defaults to one summary card showing the garden name and saved area; it explains that later garden-location changes also apply to the plant. A secondary Use a different location action reveals the existing search/map picker for that plant, with a clearly named action to return to the garden location. Switching back and forth keeps the draft custom choice within the mounted step, and garden save resolution remains authoritative.

The creation nickname field and its review row are removed. Existing nickname values remain compatible with saved drafts and records. The Continue without weather shortcut is removed because it silently cleared an existing location; the normal Continue action is used in every case. A plant without a chosen location gets a brief optional-location note. No garden settings or existing plant data are changed by this screen.

Phone browser review confirmed the default summary, explicit different-location picker, return to the garden location, and one Continue action. No plant was submitted. TypeScript, lint, and 35 focused creation/location tests passed.


## Visible location map

The shared location picker now shows an interactive map immediately alongside search and Use my location. The compact map is 160–200 px high, with direct enlarge/recenter icon controls. Choosing or adjusting a pin leaves the map visible. Existing reusable locations are shown as horizontal cards when allowed. The Other ways to choose disclosure and manual coordinate entry are removed, along with map-error suggestions to enter coordinates. GPS permissions remain user-triggered; displaying the map never chooses or saves a location automatically. The normal form save still persists the selected location.

The 390 px browser check confirmed the inline map, direct larger-map entry and return, and the absence of the former options menu. TypeScript, lint, and 15 location/device-location tests passed. No pin or plant was saved during browser review.


## Phone controls on plant details

Weather refresh is an icon button inside the weather card header, including its empty/error state. It has a 48 × 48 tap target, a screen-reader label, and a disabled loading spinner. Historical dates still expose no refresh action. The freshness label remains below the card. Weather-details and earlier-location disclosures have a full button surface.

The Details section uses pencil icon buttons for editing. Photo, journal-entry, lifecycle and care-advice text actions retain descriptive labels with icons and visible button boundaries; disclosure rows keep chevrons and their expanded state. The pinned toolbar back button now sizes to its arrow-and-label content to avoid overlapping the plant name. Existing destructive confirmations and save guards stay intact.

At 390 px, the actual weather icon was clicked and verified through disabled/loading feedback to Weather updated just now; no journal activity or plant details were changed. The Details pencil opened its corresponding editor. TypeScript, ESLint, architecture checks and 77 suites / 368 tests passed.

## Plant cover banner

The plant detail banner uses a full-width cover photograph that fades into the card surface. The name, optional strain, growth stage, status and environment sit together below the image. A pencil icon replaces the separate Edit plant row, and a camera affordance makes the existing cover-photo action discoverable. Both use the existing accessible controls and callbacks. Plants without a usable photo retain the botanical illustration. Cover height scales between 170 and 240 px, and stored photos use the full image rather than a list thumbnail.

Browser review covered 320 px and 390 px widths in Daylight and Grove themes, including the cover action opening Photos. TypeScript and the banner's ESLint check passed. No plant details or photos were changed.

## Compact daily care advice

Journal care advice is one collapsible Care today card. It starts minimized with the total note count and the highest-priority note's severity and full title. Expanding shows severity-sorted rows separated by fine rules, rather than individual bordered cards. Each row has one disclosure; only one explanation can be open at a time. Explanations retain the original summary, distinct supporting reasons, confidence and recording action. Minimizing closes the explanation. Refresh is available inside the expanded card. The redundant Review advice text, always-visible preview/action and separate Show other care notes button are removed.

Phone browser review checked 320 px and 390 px, both themes, minimizing and switching explanations. TypeScript, focused ESLint and 12 care-disclosure/journal-flow tests passed. Care algorithms and saved journal data remain unchanged.

## Mobile plant editing

The persistent top-bar Edit plant button opens one continuous form directly. Plant profile, Growing setup, Care routine, Location and Profile notes appear in that order, with visible fields and clear headings. The intermediate category menu is removed. Optional strain, height, soil and history fields are visible in this full editor. Dropdown options remain attached to their fields, and conditional pot/sensor/sunlight/reminder controls appear only when relevant. One pinned Save changes action validates every changed section before issuing a single update; untouched sections are omitted. The existing draft recovery, discard protection, conflict checks and saving locks remain. The banner and individual Details sections have no repeated profile-edit controls.

Editor selectors now expand directly beneath their fields with bounded scrolling, search for long lists, explicit unspecified choices and Android Back dismissal. Existing custom routine/profile values remain selectable. Location editing uses an explicit garden-location summary and a direct different-location action instead of radio choices; custom location and optional place label remain available. Previously recorded weather remains unchanged.

Browser review covered all five sections at 390 px, attached dropdowns and optional fields, plus notes at 320 px. No plant changes were saved during review. The existing validation, conflict detection, draft recovery, discard guards and save locks remain in place. TypeScript, full lint, the 78-suite/371-test existing suite and three additional editor-control tests passed.

The single-page flow was reviewed at phone width, scrolling from profile through setup and down to notes. TypeScript, focused lint, architecture checks and 21 form/control/journal tests passed, including combined changes, unchanged-section preservation and validation before a combined update. No plant changes were saved in browser review.

## One plant-edit entry point

A single top-bar button pairs a pencil icon with the visible label Edit plant. It remains reachable on Journal, Photos and Details while scrolling, and opens the continuous editor directly. The banner pencil and five section pencils are removed. Profile cards are read-only summaries with their existing disclosures. Journal-entry editing stays scoped to the selected entry. The compact toolbar avoids a repeated pinned plant name below 400 px so Back, Edit plant and the theme control fit at 320 px.

Browser review verified the Details layout at 320 px and 390 px and opened/closed the full editor without saving. TypeScript, focused ESLint and 12 profile/journal-flow tests passed.

## Compact continuous editor

The full editor uses 12 px between fields, compact 48 px minimum controls and paired short fields: stage/height, strain name/type, age basis/estimated days, environment/planting, pot/sunlight or sensor, watering/feeding, and soil type/pH. Notes and location retain full width. Repeated strain, height, soil and history subheadings are removed from the full form. Age uses Start date or Estimate with one sprouting/rooting explanation. Blank note areas start at 88 px. All fields remain on the same page; Save stays pinned. Paired fields wrap as needed and stack when device font scale exceeds 1.2.

The 390 px review fits the complete profile and the beginning of setup in one screen; 320 px also fits the profile. Attached options were opened and closed without changing data. TypeScript, focused lint, architecture checks and 22 form/control/journal tests passed.

## Anchored home overflow menus

Garden and plant three-dot menus use the shared AnchoredActionMenu instead of bottom sheets. A 48 px measured trigger opens a compact 272 px floating panel with a pointer back to the active dots, subtle scrim, rounded corners and 160 ms fade/scale motion (disabled for reduced motion). Positioning clamps to screen edges and safe areas, opens above the trigger when needed and scrolls long content. Resize dismisses stale positioning. Outside tap, repeated trigger tap, Escape/Android Back dismiss. Menu rows remain at least 52 px with icon and label; the garden's Past plants action is separated from management actions.

Garden settings, Manage plants, Log garden watering and Past plants retain their existing destinations and confirmations. Plant menus retain Open plant and Move to garden. The larger destination forms stay unchanged. Browser review checked garden and plant menus at 390 px, settings/move routing without saving, and upward placement at 320 x 480. TypeScript, full ESLint, architecture checks and all 80 suites / 383 tests passed.

## Manage plants redesign

The garden's Manage plants destination focuses on membership. A fixed toolbar, compact cream garden summary, Add existing and New plant actions, search and member count use the same Grove tokens and 48 px controls as Home. Member cards open plant details and expose named Move and Remove actions; there are no hidden swipe controls or per-plant overflow menus. Removal asks for confirmation and keeps the plant, journal and photos. Garden settings, bulk watering and garden deletion remain in a compact anchored garden menu; destructive deletion is visually separated and retains its confirmation. The old weather/average-age overview, watering controls in each row and floating duplicate add button are removed from this management view.

Add existing opens a matching searchable picker in place, limited to plants with the same environment and outside the current garden. Rows show their current garden, selected cards have clear checkbox feedback, and one pinned Add action shows the selection count. It preserves the existing atomic membership service and capacity checks, adds a membership baseline for conflict protection, and guards unsaved selections. Adding, moving, removal, settings and delete retain saving/error locks. New plant still passes the current garden ID.

Browser review covered 390 px and 320 px, search/no-results/clear, existing-plant selection then deselection, move routing and removal cancellation. No membership or plant records were changed during browser review. TypeScript, full lint, architecture checks and all 81 suites / 387 tests passed, including the new management-flow checks.

## Compact square-photo home plant cards

Following visual feedback, the tall edge-to-edge photo treatment was replaced with inset square photos: 80 px on narrow cards and 88 px otherwise, with rounded corners. Cards start at 104–112 px high and grow when metadata or names wrap. Name, metadata and growth stage form one compact stack. Quick watering uses a separate 48 px icon button; the checkmark communicates watering already recorded. Existing accessibility labels, loading/disabled states, image fallback and navigation are retained. No plant overflow menu is reintroduced.

Browser review covered 320 px and 390 px widths. TypeScript and targeted ESLint passed.

## Delete from the plant editor

The full Edit plant form has a separated Delete plant action below the final fields. Its destructive confirmation names the plant and explicitly includes journal, photos and saved conditions; dirty edits are also mentioned. Cancel preserves the form. Confirmation uses the existing owner-checked, resumable deletion service and returns to the originating list/garden after success. The discard guard allows the confirmed deletion navigation and restores protection after a failure; errors stay in the confirmation for retry. Save/delete locks prevent competing writes. Destructive ActionDialog styling is opt-in so other confirmations retain their appearance.

Browser review opened and cancelled the confirmation without deleting real data. Tests cover cancellation, successful deletion/draft cleanup/navigation and failed deletion with draft retention. TypeScript, targeted ESLint, architecture checks and all 82 suites / 390 tests passed.
