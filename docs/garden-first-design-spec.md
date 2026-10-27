# Garden-first app design specification

Date: 27 October 2026

Status: Proposed implementation specification; application behavior has not been changed.

Purpose: Define the screens, interactions, domain rules, migration, and delivery sequence for a garden-first WeedGrow.

Implementation note: a deliberately smaller [initial garden-first Home slice](garden-first-home.md) has been implemented. The remainder of this document is still a proposed roadmap; it is not a description of the current app.

## 1. Product direction

**Home is the current garden. Its plants are immediately visible.**

Design for someone with one garden; support multiple gardens through a small, discoverable switcher. Do not put a garden directory between opening the app and seeing plants.

The normal journey is:

`Open app → current garden and plants → individual plant → Journal / Photos / Details`

Additional journeys are:

- `Garden name → switch garden → that garden's plants`
- `Home → Log watering / Log feeding → choose plants and enter details → review → save`
- `Home → Add plant → plant-specific setup → save into current garden`
- `Care → checks for current garden → record actual care, snooze, or skip`
- `Search / All plants → find a plant across gardens → open it directly`

Accepted direction from the discussion: remove the Groups / Plants home split, assign plants to gardens, show plants directly on home, and support multiple gardens without burdening the one-garden experience. Detailed choices below are recommendations for implementation, including the revised bottom navigation.

The assumption that most users have one garden is a design hypothesis, not a measured usage statistic. Check it through usability sessions and later usage data.

## 2. Evidence and current-state audit

This spec is based on route, component, service, model, rule, and design-document inspection, plus saved mobile screenshots in the repository. It is not a new live-device usability test. Source takes precedence over older screenshots and superseded documents; in particular, Today has already merged into Journal.

| Area | Current behavior and source | Design implication |
| --- | --- | --- |
| Main navigation | `app/(tabs)/_layout.tsx`: Home, Profiles, More. Profiles opens sensor-profile management. | Give recurring care a primary destination; retain profiles as a supporting tool. |
| Home | `features/home/screens/HomeScreen.tsx`: Groups and Plants swipe tabs. Plants has global search/status filters, hero, list, overview, and advice. | Replace two competing entry points with one scoped garden home. |
| Group collection | `features/home/components/GroupList.tsx`: garden-like cards, type filters, search, sorting, management. Search can match a member's name but returns groups. | Reuse its underlying collection behavior in a secondary garden manager; search should return plants directly. |
| Group detail | `features/groups/screens/GroupDetailScreen.tsx`: shared weather, plant search, individual quick watering, removal, group watering, edit/delete. Its Add Plant action opens existing-plant selection. | Merge useful daily functions into home; distinguish creating a plant from moving an existing one. |
| Group creation | `features/addGroup/hooks/useAddGroup.ts`: requires existing plants and derives type from the first selected plant. | This path cannot create the first garden before the first plant. |
| Saved locations | `app/locations.tsx`: a separate route can create an empty group, but requires a name and pin. | Empty-space support partly exists. Consolidate the two creation paths and make location optional. |
| Plant creation | `features/addPlant/AddPlantFlow.tsx`: Your plant, Setup, Location, Details, Review. Growing space is optional; Separate setup is offered. | Make garden context automatic and remove repeated environment/location decisions. Preserve draft and save reliability. |
| Membership | `features/groups/api/membership.ts`: one optional group per plant; mirrored membership; same-type restriction; moves between groups are transactional. Removal/deletion clears membership. | Existing model is close, but mandatory membership and cross-type moves need service changes. |
| Settings inheritance | Garden selection fills environment, location and sensor values. `locationMode` distinguishes Follow from Custom; sensor values are copied references without an equivalent mode. | Define shared sources explicitly; copying values once is not ongoing inheritance. |
| Capacity | `features/groups/groupPolicy.ts`: 80 members per space; current atomic watering cap is 8. | Keep capacity honest and design bulk work beyond eight with explicit recovery. |
| Bulk records | `lib/logs/groupWatering.ts`: watering only, today's per-plant day, inactive/already-watered members skipped, atomic up to eight total members. | Feeding, selection, amounts, historical dates, and resumable larger operations are new work. |
| Plant detail | `features/plants/screens/PlantDetailScreen.tsx`: Journal / Photos / Details, dated activity, photo flow, section editors, theme choice, lifecycle controls. | Preserve this recent work. Change garden context and navigation, not the plant's core organization. |
| Care | `app/care.tsx`, `features/care/useCareTasks.ts`: all-account tasks; routines, completed/skipped states, snoozes; accessible through More. | Add explicit scope and promote discovery. A missing routine is not a completed check. |
| Aggregate overview/journal | `features/home/components/GardenOverview.tsx`, `app/journal.tsx`: account-wide data called garden data; journal filtering operates over loaded pages. | Distinguish current-garden scope from All gardens and label partial search coverage. |
| Conditions | Group detail uses outdoor weather from a selected member's pin or group pin. Profiles expose manual values / hardware choice, but the inspected weather/advice paths do not establish a live sensor ingestion pipeline. | Never label outdoor weather as tent climate or imply hardware is connected merely because a profile exists. |
| Visual foundation | `design-system/tokens/garden.ts`, PlantCard, current profile and journal components. | Retain Grove/Daylight, rounded surfaces, lime actions, readable typography, and the existing icon family. |
| Storage/access | `services/gardenData.ts`: owner-scoped plant/group stores. `firestore.rules` validates ownership but does not enforce required garden membership. | UI validation alone cannot establish the new invariant. Storage compatibility and rules are part of delivery. |

The underlying problem is overlapping ownership of context: Home's plants view, group detail, Garden locations, and plant setup all partly define where a plant lives. The redesign should give garden context one clear home.

## 3. Domain language and ownership

### 3.1 Terms

- **Garden:** one named growing space with a shared environment. Examples: My garden, Patio, Flower tent, Greenhouse.
- **Environment:** a garden attribute: Indoor, Outdoor, or Greenhouse. It is not a second container/navigation level.
- **Plant:** an individual with its own identity, routine, lifecycle, measurements, photos, and history.
- **Care check:** a task derived from the plant's saved routine. It is not proof of actual need or completed treatment.
- **Activity:** something recorded as having happened. Journal is where activities are read.
- **Conditions:** source-labelled outdoor weather or recorded indoor/greenhouse values.

Use Garden in user-facing copy everywhere currently using Group, Collection, or Growing space for the same object. Preserve useful distinctions such as Plant profile and Sensor profile. Do not introduce rooms, zones, beds, batches, and groups as additional containers in this release.

### 3.2 Membership and lifecycle

Every newly saved plant has exactly one existing, account-owned garden. This applies to inactive plants as well as active plants; lifecycle changes retain membership. Legacy unassigned records remain readable during migration but are not a permanent second organization model.

A garden represents a lasting place, not one grow cycle. Harvesting the last plant leaves the same garden ready for new plants; past plants remain accessible through its status filter. Do not require a new garden each season. This exposes a capacity issue: the current 80-member array includes inactive plants. The target policy is **up to 80 active plants per garden**, with older plants retained outside that bounded active-member index. Capacity/lifecycle indexing must be updated before claiming this behavior; simply retaining every historical ID in today's capped array would eventually prevent reuse.

Gardens have Active or Archived status. An archived garden may retain inactive plants and their histories. It cannot receive new plants or contain active plants. Restoring a plant in an archived garden requires choosing an active garden, or restoring the garden first. Garden archive is distinct from plant archive.

Delete a garden only when it has no plant references of any status and no unfinished operation. Never cascade-delete plants or their histories. Hide archived gardens from the normal switcher list but expose Show archived in Manage gardens. Users may archive/delete their last empty garden and return to first-garden setup.

### 3.3 Field ownership

| Garden-owned shared context | Plant-owned individual information |
| --- | --- |
| Name, environment, status | Name, strain, stage, start date / estimated age, lifecycle |
| Location label/pin and time zone | Container, medium, pot size, measured height/pH, sunlight/protection exceptions |
| Default condition/sensor profile | Watering/feeding routines, reminders, fertilizer, snoozes/skips |
| Derived member and care counts | Journal, progress photos, harvest, training/pest history, lasting notes |
| Shared condition source and freshness | Explicit legacy location/profile overrides where needed |

Shared context does not imply identical care. This release has no automatic garden-wide routine, fertilizer prescription, or schedule overwrite. Any later Apply routine to plants feature must be a separate, reviewed bulk edit.

## 4. Information architecture and scope

### 4.1 Bottom navigation

Recommend **Home / Care / More**, preserving the current three-item layout and styling.

- **Home:** selected garden, shared context, plants, logging entry points.
- **Care:** scheduled checks, initially scoped to the selected garden, with an explicit All gardens option.
- **More:** Manage gardens, All plants, Search journal, Sensor profiles, account, device settings/reminders, backups/exports.

Move Profiles out of the primary bar. Sensor profiles remain accessible from Garden settings → Conditions and More → Sensor profiles. Do not create a fourth primary tab or make garden management the new landing page.

### 4.2 Scope contract

Home always represents one garden. It never becomes an ambiguous All gardens home. A separate All plants view supports cross-garden browsing.

Home counts, default plant list, bulk targets, conditions, and primary activity preview all belong to the selected garden. Show a compact cross-garden care link only when other gardens have due checks: for example, “3 checks due in other gardens.” This opens Care with All gardens selected; it does not switch gardens silently.

Care and journal searches have visible garden scope. Opening Care through its tab initializes to the current garden. A deliberately chosen All gardens scope can persist while that Care session remains open; choosing another garden on Home resets garden-scoped Care on the next visit. Account changes always clear the scope.

All plants is a browse/search destination, not a selectable garden. Bulk care is restricted to one garden per operation in this release.

## 5. Home screen specification

### 5.1 Reading order

1. Existing compact brand/account header; replace the quiet date text with an accessible global plant-search action. Keep search and account targets visible at small widths; let the wordmark contract rather than squeezing touch targets.
2. Garden name with chevron and separate garden-settings overflow. Subline: environment and active plant count.
3. Compact conditions summary, with source/freshness and an expand/open action.
4. Today summary: due checks first; advice review count separately, if available. Log watering and Log feeding are secondary actions for recording completed work.
5. Plants heading/count and primary Add plant button; filter/search controls are attached to the list.
6. Plant rows immediately accessible through the same vertical scroll.
7. Quiet Garden journal link / recent activity disclosure below the list. Load its entries only when opened.
8. Existing bottom bar, with Care replacing Profiles.

Do not carry over the large collection introduction, account-wide grow hero, average age, or setup-gap counts above the plants. Useful shared information should fit into a compact daily dashboard.

### 5.2 Low-fidelity layout: one garden

```text
 weedgrow.                    Search  Account

 My garden  v                            ...
 Outdoor · 4 active plants

 24°C · 61% humidity                 Conditions >
 Outdoor weather · updated 10:20

 Today                             View care >
 2 checks due · 1 advice item to review
 [ Log watering ]  [ Log feeding ]

 Plants · 4                       [ + Add plant ]
 Active v                         Search  Filter

 [photo] Zane 3                        [ Log ]
         Vegetative · Blue Dream
         Watering check due

 [photo] Olive                         [ Log ]
         Seedling
         Watering recorded today

 Garden journal >

       Home          Care          More
```

Illustrative names/values only; never use the example weather or care counts as defaults. On a 390 × 844 viewport at standard text size, aim for the first plant row to start within approximately the first 500 px of content, with the row visible above navigation. Verify actual layout; allow more height for large text, long names, and alerts.

### 5.3 Garden header and switching

Garden name is a button with a visible chevron even for one garden. Accessibility label: “Switch garden, current garden My garden.” Avoid a numeric garden badge when there is only one.

Tap opens a bottom sheet on mobile / constrained dialog on wider screens:

```text
 Your gardens                              Close

 ✓ My garden       Outdoor · 4 active plants
   Flower tent     Indoor  · 6 active plants

 + Create garden
 Manage gardens >
```

Use simple rows, not the current large illustrated group cards. Rows may include a due-check count only when loaded; an unknown count is not zero. Search the switcher list once it exceeds six active gardens. Explicit Close is always available.

Selecting a garden closes the sheet and changes only viewing context. Persist the last selected garden per account on this device. Store list filters/scroll by garden during the session; a newly visited garden starts with Active and default sorting. Reopening the app restores the garden but defaults to the active list. Never render the previous garden's data under a new title while loading.

If the saved ID is unavailable, choose a valid active garden deterministically (oldest creation date, ID as tie-breaker). If none exist, show creation or archived-garden recovery. Do not create a garden automatically because a request failed. A temporarily failed load must not be interpreted as “no gardens.”

### 5.4 Conditions

Outdoor: show available weather with an Outdoor weather label, meaningful source time, and stale/error state. Missing data displays “Weather not set up” or “Conditions unavailable,” never zero readings.

Indoor: show the garden's configured recorded/manual values with “Manual values” and the profile update time. No live badge unless a real data source, reading timestamp, and freshness contract exist. A hardware-labelled profile without verified readings displays “No readings available.”

Greenhouse: label internal readings and Outside weather separately. Never combine external temperature with internal humidity into one apparently uniform reading. Keep the initial summary compact and show secondary information on expansion.

Garden conditions use garden settings. Retire the user-facing choice to take the garden's weather from an arbitrary member plant. Handle legacy `weatherSourcePlantId` explicitly during migration. Plant-level historical weather remains where it is.

### 5.5 Care summary

Count routine-derived checks separately from weather/advice items. “2 checks due” counts tasks; “2 plants need review” counts unique plants. Do not add these values together as one attention number.

Care is an invitation to inspect and record actual actions. Do not label all plants healthy because there are no due tasks. Distinguish:

- No routines set: “No care routines set. Add one from a plant's Details.”
- Routines exist, none due: “No scheduled checks due.”
- History loading: “Checking care history…”
- History error/stale: “Care status unavailable” with retry.

Show advice only when current, relevant inputs are available; explain missing/stale conditions on the relevant panel. Do not block reading plants when advice cannot load.

### 5.6 Plant list and actions

Default Active. Replace the always-visible row of Active / Archived / Harvested / Dead / All pills with a compact status selector; retain every status in its menu. Filters include stage, container, and training where useful. Environment filtering is unnecessary inside one garden, but remains in All plants. Default sort Name; offer newest and care priority once its data is available. Never reorder the list unexpectedly as background care data arrives.

Reuse PlantCard anatomy: thumbnail, clear name, stage, optional strain, compact care status. Omit repeated environment from every row inside a garden; show garden name/environment in cross-garden lists. Unknown age stays unknown. Never add a synthetic “health score.”

Replace the current one-tap Water mutation with a labelled **Log** action that opens an activity picker for that plant. Watering and Feeding open their task-specific forms directly from this picker; other choices use existing composer categories. Do not record activity from tapping a row, a badge, or a swipe. The row's main target opens Journal for today.

Keep row navigation and Log as sibling targets, not nested presses. An accessible row action menu exposes Move to garden and plant management. Swipe may provide a shortcut but is not the only way to reach any action. Inactive rows have no new-care action.

Add plant always creates a new plant in the selected garden. Move existing plants is a separate management action. No Add plant button should open an existing-plant membership picker.

List search is scoped to this garden and expands inline from its search control. Global search in the app header opens All plants search. Empty scoped results offer Clear filters and, when relevant, Search all plants.

## 6. First use, authentication, and garden creation

### 6.1 No gardens, no plants

Home: “Create your garden” with a short explanation, e.g. “A garden can be a patio, greenhouse, or indoor tent.” Primary Create garden; supporting sign-in access where necessary. Account loading and garden loading must finish before declaring the account empty.

Creation has one compact form:

- Garden name, suggested “My garden”; 1–100 trimmed characters.
- Environment: Indoor / Outdoor / Greenhouse, explicitly confirmed. Existing device preference may preselect but is not proof of the user's environment.
- Optional location, disclosed when relevant; town-level precision is sufficient for outdoor weather.
- Optional condition profile for Indoor/Greenhouse; Add later is valid.
- Save garden.

Name + environment are sufficient. No existing plants, map pin, profile, photo, or care routine is required. Save with a stable request ID, show field errors in place, and preserve input after failure. A name duplicate is allowed; show environment/location to disambiguate selections.

After creation, open its empty Home: “Your garden is ready for its first plant,” primary Add plant. Do not show a second garden-success screen or onboarding checklist.

### 6.2 Signed-out drafts

Preserve the current ability to prepare a local plant draft before signing in. The draft may include a proposed garden name/environment. Require authentication and an owned garden before saving the plant. At final save, create/choose the garden, then save the plant using stable IDs. If garden save succeeds and plant save fails, retain and reuse the empty garden on retry.

Never assign a previous account's garden to a new account. On account change, clear active-garden context and offer only eligible draft recovery. Do not silently upload an anonymous or previous-account draft.

### 6.3 Creating an additional garden

Switcher → Create garden uses the same form. Creating it from Home selects it after save. Creating it inside a Move or Add Plant flow returns to that flow with the new destination selected; it must not discard the original form or silently move plants.

## 7. Add Plant redesign

Retain the current form components, optional details, prepared-photo handling, validation, stable plant ID, and draft recovery. Change the sequence to four steps:

| Step | Content |
| --- | --- |
| Your plant | Name, growth stage, known start date / estimated age / unknown, optional strain. |
| Plant setup | Garden summary, pot/ground, optional pot size, medium, measurements, sunlight/protection and other plant-specific setup. |
| Care & photo | Optional first photo, actual last-watered/last-fed dates, individual routines, fertilizer, notes/history disclosures. |
| Review | Garden prominently named; shared versus individual settings distinguished; section edit links; Save plant. |

Garden summary appears at the top throughout: “Adding to My garden · Outdoor.” Change opens the garden chooser. Changing destination updates inherited context, preserves individual details, and reports any incompatible optional values for review. Do not clear a typed form silently. Resume restores its original garden rather than replacing it with whichever garden is currently selected on Home.

Remove the separate Location step for normal new plants. Environment and condition profile are read-only shared facts in this flow, not freely editable values that can detach membership. Edit garden settings is a separate deliberate destination with return to the draft.

New plants follow their garden's location/profile by default. Do not offer Separate setup. A rare existing location override remains visible in the existing plant's Details and migration review, not as a prominent first-plant choice.

Review must not frame omitted optional fields as unfinished required work. Keep age separate from the date added. Initial care dates create actual plant journal entries exactly once. Routines do not imply enabling notifications.

Save completion is concise: “Olive added to My garden.” Primary Open plant; secondary Back to garden; Add another retains the same garden. Preserve the current plant Journal / Photos / Details destinations, and avoid stacking another welcome menu over the saved plant.

Exit retains a meaningful draft with Save on this device / discard behavior consistent with existing editors. Failed saves remain on Review with retry. If the destination was archived/deleted/full or its shared context changed materially, keep the draft and request re-selection/review.

## 8. Individual plant experience and navigation

Keep Journal / Photos / Details, existing date navigation, activity/photo drafts, date-aware saving, section editor behavior, historical weather, and lifecycle services. Do not reintroduce Today as a fourth section or build a second stats screen.

Details gains a clear Garden row near Growing setup, with garden name, environment, inherited-source label, and Move to garden. Shared values are read-only here with Edit garden settings as the appropriate destination. Plant routines stay editable independently.

Location/profile overrides from legacy records are labelled “Custom for this plant,” and show Use garden settings as an explicit conversion action. Existing custom coordinates/readings are preserved until that action or a reviewed move. New ordinary location edits should guide the user to Garden settings or Move to garden; advanced override maintenance can remain for compatibility.

Back behavior uses navigation origin, not only membership:

- From Home: return to the same garden/filter/scroll position.
- From All plants/search: return to those results and their query/filters.
- From Care: return to its scope and position.
- From journal search: return to the search and open/highlight the requested recorded entry.
- Cold notification/deep link: open the plant directly; fallback Back opens its current garden, resolving ownership first. If archived, show archived context or a clear history destination.

A garden chip in plant details can open that garden explicitly. Opening a plant from global search does not silently change Home's saved garden. If a plant moves while its screen is open, update the membership label but retain the original back destination while it remains valid.

Use serializable, validated origin identifiers rather than arbitrary external return URLs. Replace `tabIndex`, `returnToPlants`, and `fromGroupId` assumptions progressively, retaining compatibility adapters for old links.

## 9. Bulk watering and feeding

### 9.1 Entry and selection

Home → Log watering or Log feeding opens one reusable mobile sheet/full-height flow; desktop uses the same sequence in a constrained dialog. Garden name and date remain visible throughout.

Step 1: **Choose plants.** Show active plants in the current garden, last relevant activity, check status where known, and selection count. Eligible plants are selected by default because the entry action is explicitly garden-wide. Provide Select all / Clear and individual exclusions. Plants already watered on the target day are visibly skipped under the existing one-watering-per-day policy. Inactive/deleting/unavailable plants cannot be selected. Filtering the visible selection list must not change selected targets silently; always show total selected and any selected-outside-filter count.

Feeding follows existing repository behavior: stable operation IDs prevent retry duplicates, while a prior feeding on the same day is a visible warning rather than an invented one-feeding-per-day restriction. Require a deliberate Include for such plants before creating an additional feed record.

An unknown history state disables confirmation for affected plants and offers retry. Excluding those plants is allowed with an explicit summary. No eligible plants → explain why, with a link to recorded activity; do not present Save for zero targets.

### 9.2 Shared details and review

Step 2: **Care details.** Watering: optional amount labelled “Water per plant (ml),” optional pH/notes. Feeding: optional fertilizer name, nutrient dose labelled “ml per litre,” optional solution volume per plant, pH/notes. Preserve unknown values; do not invent a dose or divide a total amount automatically. Values apply identically to selected plants. If treatment differs, deselect those plants and record separately in this release; per-plant form overrides can follow later.

Date defaults to Today with the exact calendar date visible; allow historical dates with existing validation. It records completed work, never schedules future care. Today is resolved against each plant's current effective time zone. If selected plants span calendar dates, show date groups in review and require confirmation. Freeze these targets for the operation. If midnight, a move, or a time-zone revision changes the meaning before commit, revalidate and ask for reviewed confirmation rather than silently changing dates.

Step 3: **Review.** Show garden, type, selected names/count, date(s), skipped/excluded counts and reasons, and shared values. Confirmation label: “Save watering for 4 plants” / “Save feeding for 4 plants.” Back preserves selections and fields. Closing meaningful work offers save draft/discard; operation draft is keyed by account, garden and activity type.

### 9.3 Save, partial completion, and recovery

Save one normal journal entry per selected plant. Each remains available for individual edit/delete; do not create a single garden log as a substitute for plant history. Store a common operation ID and garden-at-event metadata so provenance survives later moves or renames. Saved membership is not reconstructed from a plant's current garden.

For up to eight eligible targets, preserve an atomic save if the final operation fits the verified transaction/rule budget. The current implementation's cap is based on total group members; replace that with reviewed selected targets. Do not simply increase the constant to 80.

For larger selections, implement durable, resumable bounded chunks, with a saved operation manifest, immutable reviewed payload/targets, per-target stable IDs, completion status, and retry reconciliation. Each chunk revalidates ownership, active state, membership, date/revision, and duplicate policy. Chunk size must be validated against the actual proposed rules; eight is the current ceiling, not a guarantee after adding rule reads.

Example feedback: “Recorded for 8 of 12 plants. 4 remain. Retry remaining.” Completed targets never run again. A lost response after commit must reconcile as completed; a concurrent identical-day watering becomes a skip; moved or archived plants require review and are not followed into another garden automatically. Reloading/restarting can resume the same operation. A duplicate tap cannot create another manifest. Two independent operations are revalidated against each plant's latest journal state.

Show progress without claiming the whole garden saves atomically. Successful records remain valid after a later chunk fails. Do not attempt an automatic compensating deletion of earlier records. After success, update lists/care counts from committed results, close to the original garden/scroll, and offer View records. Multi-plant records use explicit journal management rather than an unsafe one-click bulk Undo. Any retained single-entry Undo must keep the existing revision guard.

This functionality is required before presenting unrestricted bulk care for gardens above eight plants. It can ship later than the first home redesign, but the interim UI must clearly cap selections and never promise a larger save.

## 10. Care, search, and journal scopes

### 10.1 Care

Promote the existing checklist, retaining individual routines, snooze, skip, and confirmation semantics. Header names the scope: “Care · My garden” or “Care · All gardens.” For All gardens, group by garden; sort due tasks before upcoming checks within each section. Expose Due / Upcoming / Recorded or skipped status filters without treating those as separate care databases.

Each task states plant, garden where relevant, action kind, due date/time, and source routine. Open plant routes to its relevant care/journal context. Record completed care reuses the same category form as individual logging. Snooze and Skip never create watering/feeding history or reset routine completion. Zero due checks is distinct from zero configured routines. Expired history cannot appear as all tasks complete.

Notification permission/device scheduling remains opt-in and account-aware. The navigation redesign does not promise web notifications, change existing device limits, or imply enabling a routine enables push notifications.

### 10.2 All plants and global search

Accessible through header search and More → All plants. Show plant results directly with garden name, environment, stage and status. Search name/strain, with garden/status/stage filters and the existing useful plant filters. Active is the browse default; show a visible option to include inactive plants when searching. Search covers loaded account collection coverage honestly and must expose partial/error states.

Opening a result goes directly to that plant. Opening its garden is a separate action. Add plant from All plants requires an explicit destination chooser, preselecting the current garden. This view does not support garden-wide bulk selection across different gardens.

### 10.3 Garden journal

Home → Garden journal starts scoped to the current garden. More → Search journal starts with a visible scope control, initially the current garden, with All gardens available. Preserve bounded paging and label partial coverage; do not represent matches among loaded pages as exhaustive results. Link directly to the entry's saved day and highlight it, preserving search context on return.

Historical scope must be explicit. New entries with garden-at-event metadata appear under the garden where the event occurred. Pre-migration entries without that metadata remain searchable in All gardens and through the plant. Offer a labelled “Current plants' earlier history” inclusion for a garden search; do not invent past garden membership. Copy the event garden name into the record as provenance while preserving an ID for filtering.

## 11. Garden management, movement, and shared changes

### 11.1 Settings

Home overflow → Garden settings: Basics, Location, Conditions, Manage plants, and garden archive/delete. Reuse focused section editors and the readable-profile presentation established in Plant Details. Management is secondary; do not show all configuration fields on daily Home.

Location editor reuses current place search/current location/map behavior, with the place name prominent and coordinates secondary. Ask for device permission only after Use current location is chosen. Optional location remains optional. A saved-location picker may copy another garden's pin but never links two gardens' future movement.

Condition-profile editing identifies other linked gardens/plants before saving shared profile values. Link/unlink changes require a before/after preview; deleting an in-use profile remains blocked or requires explicit unlinking. A missing profile is Unavailable, not a silent switch to outdoor weather.

### 11.2 Shared setting edits

Garden name changes update present-day labels; historical event snapshots keep their original names. Location changes show how many plants follow and how many custom locations are retained. Updating a pin invalidates current conditions and preserves previous weather/movement history. An unchanged pin or rename must not manufacture a movement.

Once a garden has any plant references, its environment is read-only in this release. Explain “To change environments, move plants to a different garden.” An empty garden may change type, with incompatible profile links cleared only after review. This avoids a casual garden setting silently changing an entire grow setup.

New plants' effective environment/location/profile resolve from garden context. Keep legacy overrides explicit. Profile inheritance needs a source mode, not a one-time copied ID; update every conditions/advice/reminder/export reader consistently. Historical condition records are snapshots, never recomputed from current defaults.

### 11.3 Move plant

Entry from plant Details → Garden or list action menu. Show source, destination, environment transition, current custom overrides, and a preview of changed location/condition sources. Offer Create garden without losing the move form.

Default new-plant behavior is Follow destination garden. For a migrated plant with custom overrides, require an explicit Follow destination / Keep custom selection; keep custom only where compatible with destination type. Crossing Indoor/Outdoor/Greenhouse is supported as a reviewed move, updating current environment and inherited sources together. Existing same-environment selection restrictions must not simply be removed without this work.

Commit source membership, destination membership, plant link/effective context, and movement event atomically. Enforce capacity and ownership inside the transaction. Check concurrent changes to membership and relevant settings; refresh the preview after conflict. No intermediate unassigned state. The journal entry includes source/destination garden IDs/names and effective date; coordinate movement history remains accurate even if the pin is unchanged but garden membership changes.

Preserve age, stage, routines, historical journal/photos, and prior conditions. Refresh/re-evaluate current care context and reminders. If routine times shift because the effective timezone changes, disclose that in review. Do not shift historical event dates.

After moving from a list, remain at the source list and show “Olive moved to Flower tent” with an explicit Open garden action. After moving from plant Details, retain the plant and update its garden label. A batch move is separate from care and must report per-plant outcomes if it cannot fit one atomic operation.

### 11.4 Archive and delete

Archive garden only after active plants have moved or been individually made inactive through their proper lifecycle flows. Archive does not harvest plants automatically. Retain inactive members/history and allow Restore garden.

Delete only an entirely unreferenced garden. A garden containing harvested/archived/dead plants cannot be deleted until those references are moved; explain the reason and link to Manage plants. Recheck authoritative membership and unfinished operations at commit, not just the screen's stale count.

## 12. Visual and interaction consistency

Use `design-system/tokens/garden.ts` as the foundation rather than adding another palette. Reuse semantic tokens through theme-aware components; do not copy Grove-only values into the new sheets.

| Element | Specification |
| --- | --- |
| Themes | Grove default; preserve Daylight and apply the selected theme consistently to redesigned surfaces. Move appearance preference to More and synchronize existing plant preference through a compatibility adapter. |
| Grove | Background `#15231c`, surface `#23342a`, text `#edf0e3`, muted `#bac8b3`, accent `#c8e78b`. |
| Daylight | Background `#f2f1e5`, surface `#fffef4`, text `#253c2b`, accent `#365c37`. |
| Layout | Content width 760 px; normal screen gutter 20 px; 12 px control gap; 18 px card radius. Retain platform safe areas. |
| Type | Main title 28 px, section 20, body 16, label 14, caption 13; allow native text scaling and wrapping. |
| Actions | Primary fill for Add plant / current editor Save; secondary surfaces for Log watering/feeding; clear destructive treatment only for destructive actions. |
| Icons | Existing MaterialCommunityIcons family; label unfamiliar and important actions. No new icon system. |
| Surfaces | A few meaningful cards with quiet dividers; avoid card-within-card stacks and a border around every fact. |
| Motion | Existing GrowMotion/reduced-motion behavior; no looping decorative hero above the plant list. |
| Touch | Target 48 × 48 logical pixels where practical, never below 44 for fully visible interactive controls; separate adjacent targets. |
| Feedback | Specific saved/failed state, accessible live announcements; unavailable values use a dash with explanation. Do not use color alone for state. |
| Editors | Mobile sheets or full-height modal flows, fixed task title and save area, keyboard-safe fields; desktop constrained dialogs. Consistent draft/close behavior. |

Keep the brand mark and natural green/cream character. Retire large promotional text from recurrent management tasks. Use concise copy: Garden settings, Add plant, Log watering, Save watering, Move to garden, Care routine. Keep Add activity for the general plant picker, matching the current plant flow.

Wide layouts retain the same order and scope; no unrelated desktop dashboard. Mobile sheets become accessible dialogs, and plant lists remain readable rather than stretching edge-to-edge. Verify 320, 390, 430 and 1024+ px, both themes, large text, keyboard focus, screen-reader names, sheet focus return, Android hardware Back, and safe-area behavior.

## 13. Empty, loading, error, and offline states

| State | Required presentation / action |
| --- | --- |
| Account loading | Stable shell; do not flash sign-in or empty-garden setup. |
| Signed out | Explain account ownership; sign in / create account; local draft option. |
| No garden | Create garden; archived-garden recovery when appropriate. |
| Garden with no plants | Garden context remains visible; Add first plant. |
| No active plants but inactive members | “No active plants”; View past plants and Add plant. |
| Filter/search returns none | Keep context/summary; Clear filters; Search all plants where useful. |
| Garden switch loading | New title and matching skeleton/content state; never old member rows. |
| Plant data available, care/conditions failed | Keep plants usable; local retry message and unknown status. |
| Data read failure | Preserve last confirmed same-garden data with a stale indication; no fabricated zero counts. |
| Offline mutation | Retain draft and explain connection needed; never show a server-confirmed success before commit. |
| Partial bulk completion | Exact recorded/skipped/remaining counts and Resume remaining. |
| Deleted/archived garden on another device | Explain, preserve eligible drafts, choose valid context explicitly. |
| Session/account changes mid-save | Cancel stale UI publication, reconcile committed work under the original account; never leak its data into the new account. |

Do not promise a general offline browse cache until tested. Current transaction-based saves require connectivity. Displaying an old reading does not make it current.

## 14. Data and compatibility plan

Keep existing `groups/{id}` documents and `Plant.groupId` initially. A user-facing rename does not require moving every record to a new Firestore collection. Introduce a Garden domain adapter/type so new UI does not spread old terminology. Defer physical collection/field renaming.

Add explicit versioned garden lifecycle/shared-context metadata, profile-source behavior, garden timezone, and event provenance as needed. New decoders accept older records during transition and expose legacy states explicitly. Keep `plant.groupId` authoritative for forward membership. During compatibility, `group.plantIds` remains a transactionally maintained legacy index; detect/reconcile disagreement rather than hiding records based on whichever list is read first.

For the permanent-garden capacity policy, derive full/history membership from owner-scoped plants filtered or queried by `groupId`, with bounded pagination. Introduce a bounded active-member index/count and total-reference count maintained transactionally through creation, moves, archive/restore, harvest, death, deletion, and import. Capacity applies to active members; deletion checks all references. Retire the legacy all-history member array at the versioned client cutover rather than giving the same field two competing meanings. Reconcile existing counts/indices before enabling the new policy. Do not claim unlimited historic scale: retain pagination and the account's verified storage/read limits.

Avoid making every garden setting edit a mandatory 80-plant rewrite. Prefer effective shared-context resolution with version checks at write boundaries; if selected consumers need denormalized values, define refresh/reconciliation before enabling inheritance. Current weather, care, notifications, editors, exports/restores, profile-deletion checks, and cache invalidation must all use the same policy. An inherited plant's effective profile still counts as a reference when deleting a profile.

New operation manifests need account-owned access rules, bounded reads/writes, idempotent target IDs, and backup treatment. This is a schema addition, not a property the current app already supplies. Verify actual rule budgets using emulator transactions before selecting chunk sizes.

### 14.1 Existing-account migration

1. Read-only inventory: owned groups/plants, membership disagreement, missing references, environment mismatch, independent pins/profiles, capacities, legacy weather source, inactive records. Produce a dry-run report.
2. Existing consistent groups become gardens in place, keeping IDs/names and members. Existing saved-location groups are the same objects and must not be duplicated as extra gardens.
3. Preserve known assignments and history. Do not put all Outdoor plants into one garden based only on type.
4. Offer “Organize existing plants” for unassigned/conflicted records, with explicit garden selection or creation. A single compatible existing garden may be suggested, never assigned merely by opening the app.
5. Show unresolved legacy plants through a clearly labelled review section / All plants so nothing disappears. Exclude unresolved plants from garden-wide care until assignment; individual history remains readable. Users can continue reading while resolving the migration.
6. Existing custom pins/profiles stay custom. Conversion to shared defaults requires preview and confirmation. Legacy weather-source plant choices get an explicit garden-pin review; do not overwrite an existing garden pin silently.
7. Preserve old entries' dates/timezones, images, IDs, ownership, and historical weather. Missing event garden metadata remains unknown; do not infer it from current membership.
8. Migration is idempotent/resumable; reconcile partial work before retry. Restore/import routes use equivalent assignment validation before activating imported plants, and preserve known archive state.

### 14.2 Rollout and enforcement

Use a compatibility phase: new writers always require a garden; legacy readers/repair flows can still read and assign old records. Strict server validation must follow migration and client compatibility, not precede them. Stage the behavior/schema version so old clients cannot continue creating unassigned plants after strict cutover.

Rules must validate owned, existing, eligible garden references for new plants/moves and prevent orphan-producing removal/deletion. Firestore rules cannot enforce arbitrary unbounded reverse queries; keep an authoritative, transactionally verified reference/index or use a trusted server boundary for protected deletion where necessary. Validate this architecture before implementation, rather than assuming a client-side empty list is sufficient.

Deploy rule/index changes only as part of the implementation rollout, after emulator checks. This document authorizes no production migration or deployment by itself.

## 15. Route and component plan

Final route names can follow Expo Router conventions, but responsibilities must remain distinct:

| Destination | Responsibility and compatibility |
| --- | --- |
| Home tab | Current GardenHomeScreen; no `tabIndex`-based Groups/Plants split. |
| Care tab | Reuse/extract existing care screen with explicit scope. `/care` links adapt to it. |
| More tab | Tools/settings, management and global browse links. |
| Garden switcher | Shared chooser, explicit modes: switch / destination selection. |
| Garden create/settings/manage | One form/editor path; replace duplicated Add Group/Garden locations creation. |
| All plants | Extract/reuse filtered plant list without account-wide home hero. |
| Plant detail | Existing route and three-section implementation, with origin-aware navigation. |
| Add plant | Existing route, revised four-step flow and frozen destination context. |
| Bulk care | Reusable selection/details/review flow and operation recovery view. |
| Journal search | Existing route with scope/provenance behavior and correct entry destination. |
| Legacy group detail | Resolve to the selected garden Home/context, preserving ID-based access checks. |
| Legacy add-group/locations | Adapt to new create/settings/move responsibilities; never silently move plants based on an old parameter. |
| Legacy Profiles tab | Redirect to Sensor profiles management; keep direct profile routes working. |

Suggested reusable units: GardenContext selector/store, GardenHeader, GardenSwitcher, GardenConditionsSummary, GardenCareSummary, scoped PlantList, GardenSettings sections, PlantGardenField, and BulkCareFlow. Extract shared category forms instead of implementing another watering/feeding validator inside Home.

Viewing context is separate from mutation destination. Every save carries its resolved garden ID and relevant revision; changing a global selector cannot retarget an open draft. Subscriptions/advice work should run for the visible garden or explicit All gardens task only, reusing owner-scoped stores where practical. Stop obsolete async results publishing after a switch. Use one virtualized plant list with a header instead of nested independently scrolling lists.

## 16. Delivery sequence

| Phase | Work | Exit condition |
| --- | --- | --- |
| 0. Prototype and validate | Low-fidelity Home/switcher/add/move/bulk screens with representative local data, including one and multiple gardens. | Users can identify current garden, open a plant, add one, and understand logging targets without explanation. |
| 1. Domain and compatibility | Garden adapter/context, lifecycle/source policies, active versus historic capacity/indexing, origin model, empty creation, membership audit/repair, draft compatibility, emulator-verified rule strategy. | Every new writer has a destination; legacy data remains visible; rules/transactions are feasible. |
| 2. Home and navigation | Replace split home, add switcher/scoped list/conditions/care summary; Home/Care/More; move profiles; preserve legacy routes. | Single-garden plants open immediately; scope cannot bleed between gardens or accounts. |
| 3. Create/edit/move | Four-step Add Plant; canonical settings; atomic cross-type move; archive/delete guards; explicit override migration. | Full plant lifecycle preserves membership/history and returns to the correct destination. |
| 4. Bulk care | Selection, shared fields, review, watering/feeding, operation manifests/chunks/recovery and provenance. | Tests prove no duplicate retry records and honest partial completion for >8 targets. |
| 5. Global tools and cutover | All plants, scoped care/journal, provenance coverage, backups/restores, migration completion and strict rules/client cutover. | No orphan-producing write path remains; old links/tools still resolve safely. |
| 6. Visual/device QA | Theme parity, small screens, large text, accessibility, real native back/keyboard/notification flows, performance. | Acceptance criteria below pass and material limitations are documented. |

Phases are implementation order, not permission to ship a misleading interim experience. In particular, hide unsupported bulk controls, preserve access to unresolved records, and do not enable strict rules ahead of compatible clients/migration. No timing estimate is implied before the prototype and rule-budget feasibility work.

## 17. Acceptance criteria and validation matrix

### Normal use

- One garden: opening app shows its active plants without first selecting a garden.
- Multiple gardens: name/chevron clearly switches context; counts/list/conditions match the selected ID throughout loading.
- A new empty garden can be saved with name/environment alone.
- Add plant from Home names/preselects that garden, never opens existing-plant selection, and saves membership exactly once.
- Add another retains destination; resume draft retains its original destination; changed global context never retargets it.
- Plant Journal / Photos / Details, saved-day navigation, independent section positions, photos, and historical weather keep working.
- All plants/search and Care retain origin/filter/scroll context after a plant visit; cold deep links have a valid fallback.
- No routine is distinguishable from no due checks; failed care history is distinguishable from completion.
- Global browse remains available with garden-labelled results; it never becomes a fake garden scope.

### Data transitions

- A plant cannot be created or moved to a missing/foreign/archived/full garden.
- Source and destination update together; concurrent moves do not duplicate or orphan a member.
- Indoor → Outdoor and reverse moves update reviewed current context and preserve all historical records/dates.
- A settings-only rename/no-op does not create a physical movement or rewrite plant history.
- A referenced garden cannot be deleted; an active plant cannot remain in an archived garden.
- Harvesting/archiving active plants frees active capacity without removing their garden history; an 80-plant completed cycle does not permanently fill the garden.
- Legacy unassigned/mismatched/custom records remain visible and require deliberate repair/conversion.
- Backup restore, old drafts, old links, profile unlink/deletion, and account switching obey the new rules.

### Logging reliability

- Bulk zero/all-skipped selections explain their state; excluded/inactive plants receive no new logs.
- Water amounts are per plant and nutrient concentration is ml/L, with absent values preserved as unknown.
- Eight eligible targets save together only within the verified budget; 9–80 use honest bounded progress/recovery.
- A lost response, double tap, app restart or Retry remaining cannot duplicate completed operation entries.
- Two devices logging watering for the same plant/day cannot both create separate watering entries.
- Same-day feeding warns and requires inclusion, without conflating retry and legitimate additional feeding.
- Mid-operation membership/lifecycle/timezone changes revalidate affected targets and preserve successful earlier records.
- Bulk success/failure counts match stored records; skipped care never appears as actual watering/feeding.

### Visual and performance checks

- Review Grove/Daylight at 320/390/430/1024+ px, long names, large text, zero/one/80 plants, and many gardens.
- Keyboard does not cover required inputs/Save; sheets trap/restore focus appropriately; Back closes the current editor before leaving its origin.
- Important actions have explicit names/targets and work without swipe or color recognition.
- Plants remain usable when conditions/advice fail; lazy activity/conditions work does not multiply per-row requests.
- Measure home startup and garden-switch responsiveness against the current app; do not claim an improvement without measurement.

Use focused unit tests for selectors/effective settings/scope, emulator integration tests for membership/rules/bulk retries/migration, and screen/device checks for flows and accessibility. Run the repository's typecheck, lint, architecture checks and relevant regression suites during implementation. This planning-only document does not require rerunning unchanged application tests.

## 18. Scope boundaries and decisions to validate

Included: garden-first Home, multiple-garden switcher, required membership, shared context policy, simpler Add Plant, scoped daily care/search, canonical garden management, bulk watering/feeding with reliable recovery, legacy migration, and visual consistency.

Deferred: nested zones/rooms, overlapping collections, automatic identical care schedules, real hardware ingestion, new analytics/health scores, a separate garden journal for shared observations, per-plant bulk form overrides, cross-account collaboration, and physical Firestore collection renaming. The garden journal in this release is a scoped view of plant activities.

Validate these proposed choices with the prototype before polishing implementation: replacing Profiles with Care in the primary bar; the compact Home reading order; Log on plant rows; the four-step creation flow; and default bulk selection with an explicit review. These are design hypotheses with specified behavior, not gaps that should be filled differently by each screen implementer.

## 19. Related design work to preserve

- [Daily Journal](daily-journal-design.md): current Journal / Photos / Details structure and date behavior.
- [Plant Details profile](plant-details-profile.md): readable sections and focused editing.
- [Plant detail refinements](plant-detail-polish.md): recent interaction/accessibility work.
- [Add Plant completion](add-plant-completion.md): account ownership, drafts, prepared photos, and idempotent setup records.
- [Location picker](location-picker.md): place labels, pin refinement, and device behavior.
- [Design consistency review](design-consistency-review.md): capacity, membership atomicity, movement/history preservation, and shared rules.

Earlier audits contain proposals that may already have been implemented. Check current source before treating an old audit item as outstanding work.
