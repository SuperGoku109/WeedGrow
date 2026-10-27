# Plant detail flow audit

Reviewed 27 October 2026.

## Scope and evidence

Started the Expo web app at http://localhost:8081 and opened the existing Zane 3 plant through Garden > Plants. Reviewed the default desktop layout and a 390 x 844 mobile viewport. Performed three passes: opening/navigation; creating/editing; and date context, retrieval, recovery and management. Opened Journal, Photos, Details, the activity composer, the watering form, the photo composer, Basics and Care routine editors, the full plant editor, advice explanations, past-day navigation, search and Manage plant.

Cross-checked transitions and forms in the source. No plant records, logs, photos or lifecycle states were saved or deleted. The empty inspection-only local log draft was discarded. Saving, populated journal editing, photo uploads/comparison, fresh-plant onboarding and native keyboard/device behavior were assessed from source where relevant, rather than claimed as end-to-end tested.

## Overall assessment

The existing Journal / Photos / Details structure is worth keeping. The visual foundation is coherent, section editing is useful, the journal action already names its target date, and destructive actions already have confirmations. The biggest opportunity is to make the next action match the user's current task, shorten routine recording, and give all editors the same navigation and completion behavior.

## Priority 1 — resolve the main flow

### 1. Make the bottom action match the active tab

**Observed:** Add log remains the large primary action in Journal, Photos and Details. The photo action is an unlabeled camera icon, even when viewing Photos. An empty gallery also introduces Add first photo.

**Improve:** Journal: primary Add activity and secondary Add photo. Photos: primary Add photo, with logging available as a secondary action. Details: prioritize contextual section editing and avoid a permanent large logging action competing with it. Keep the footer position stable while changing its meaning clearly with the selected tab.

**Check:** A person arriving on Photos can identify the main photo action without interpreting an icon or scanning elsewhere.

### 2. Consolidate the two plant editing systems

**Observed:** Banner Edit plant opens a full page containing only some fields. Details > Edit opens focused section modals containing additional fields such as care routines, notes, age and status. The editors group and label fields differently.

**Improve:** Use the Details sections as the canonical editing system. Banner Edit plant should open a short section chooser or take the user to that system. If a full editor remains, it must use the same field components, groups, coverage and validation. Remove the large promotional hero from the editing task.

**Check:** Users do not have to discover which Edit button supports the field they need.

### 3. Turn logging into a short task-specific form

**Observed:** Watering requires entering the activity composer, choosing Water, then passing a manual date and a large observations field before reaching Water amount. Height, pH and moisture are also shown. The six-category grid remains above the chosen form.

**Improve:** Keep the six choices as the activity picker. After selection, use a compact heading such as Log watering with Change type. Put water amount first, optional notes second, and Additional measurements behind a disclosure. Feeding should prioritize dose; notes should prioritize text; health and pests should prioritize observations. Retain a way to record watering without an amount.

**Check:** A basic watering entry needs no scrolling through unrelated fields and has one obvious Save watering button.

### 4. Use one date model throughout the task

**Observed:** Past-day logging correctly changes the footer to that date. However, switching to Photos or Details makes logging target today. Photo creation has no capture-date field. Activity and harvest dates require YYYY-MM-DD text entry.

**Improve:** Keep the journal's selected day visible in its composer, with a compact date picker and Today shortcut. Define photo dating explicitly: allow a taken-on date when saving older progress photos. Outside Journal, explicitly label an activity as Today rather than silently carrying or resetting a past-day context. Use date pickers for start and harvest dates too.

**Check:** Every creation form shows the exact date it will save, and changing tabs never creates an ambiguous date.

### 5. Connect advice to a useful next step

**Observed:** The flow is care-alert summary > individual advice > explanation. The soil-moisture explanation has no contextual logging action, so the user must return to the generic Add log picker. Some supporting reasons repeat in prose and bullets.

**Improve:** Expand the highest-priority advice directly, keep secondary explanations collapsed, remove repeated reasons, and offer a contextual action such as Record soil check or Log observation. Only offer Log watering after the user has decided watering was appropriate; a weather suggestion should not imply that watering has been performed.

**Check:** Users can go from reviewing advice to recording what they actually did without choosing the activity type again.

### 6. Make search behave like search

**Observed:** Search opens with instructions to Load history, then filter loaded observations. Text and activity filters cover loaded pages only. Selecting a result opens its day rather than the individual entry.

**Improve:** Load a useful bounded recent range automatically, put Search journal first, offer clear date/category filters, and search the chosen scope consistently. If the backend still needs pagination, keep that limitation visible without requiring users to understand it to begin. Open or highlight the matching entry and retain the search context on return.

**Check:** A user can type an observation and get results without an unexplained preliminary load step. Never present a partial-page search as exhaustive.

### 7. Give lifecycle changes a single authoritative path

**Observed:** Basics includes an ordinary Status dropdown with active, archived, harvested and dead. Manage plant separately offers Archive and Record harvest, with a dedicated dated harvest record. Delete plant is located in the full editor.

**Improve:** Put archive, restore, mark dead, harvest and permanent deletion together in Manage plant. Status can remain a read-only fact in Basics with a link to management. Route harvested status through the harvest form, so the result and its journal history agree. Retain confirmation and explain the effect on history.

**Check:** Users cannot accidentally bypass the harvest workflow by treating it as a routine profile-field edit.

## Priority 2 — improve continuity and confidence

### 8. Standardize editor presentation and exit behavior

**Observed:** Activities and photos use bottom sheets; section editors use centered modals; full editing uses a separate page. Close icons and Cancel labels vary. Section and full editors hard-code Grove while the detail screen supports a saved theme.

**Improve:** Use one mobile sheet/editor pattern with a task title, consistent Cancel/Close behavior, a fixed save area and the active theme. Apply the same keyboard and unsaved-change behavior throughout. Use full-page editing only when the task warrants it.

### 9. Make draft recovery deliberate

**Observed/source:** Log drafts restore automatically, and Discard local draft occupies the footer even before meaningful content is entered. Profile and photo drafts use a different recovery component. A restored log draft can replace the category and date initially requested.

**Improve:** On finding meaningful unfinished work, show Resume [activity] from [date] / Start new. Do not replace the requested task silently. Use Saved on this device as quiet status; expose Discard only when a draft exists. Closing a draft and deleting a draft should have distinct, consistent meanings.

### 10. Finish each action at its result

**Source:** Saving a log selects its day and switches to Journal; a photo save switches to Photos. Log saves sometimes reset Journal to the top. Section saves close with a generic Plant details saved message.

**Improve:** Preserve the originating section for profile changes and reveal the changed field. Reveal/highlight a newly saved or edited journal entry, rather than only the top of its day. After a photo save, reveal that photo. Use specific feedback such as Watering recorded for 26 Oct or Care routine updated. Verify these paths with real test records in an isolated environment.

### 11. Separate a persistent profile note from a dated observation

**Observed:** Notes exist in both the profile and activity picker; the profile already has explanatory copy distinguishing them.

**Improve:** Retain that distinction but strengthen action labels: Profile notes for lasting information; Log observation for a dated record. Provide a small explanation beside the input where the choice is made. Avoid making users duplicate the same text in both places.

### 12. Make care routine and reminders one understandable sequence

**Observed:** Care routine opens a modal titled Care plan, with watering, feeding, fertilizer and one general Reminder setting. Notification availability is described in a long introductory paragraph.

**Improve:** Use the same Care routine title throughout. Set frequency first, then offer reminders with a clear statement of what they remind about. Use weekday chips and a time picker instead of comma-separated days and HH:MM. Show a short schedule preview and expose device notification setup only when enabling reminders requires it.

### 13. Resolve the start-date versus age choice

**Observed/source:** Basics presents both Started growing on and Age in days as editable inputs, with precedence rules handled during saving. The profile shows 50 days (recorded), which gives limited explanation of its basis.

**Improve:** Ask whether the start date is known. If yes, enter the date and calculate age read-only. Otherwise, allow an estimated age and label it as estimated. Explain the resulting start date before saving rather than resolving competing entries silently.

### 14. Reduce the location editor's initial choices

**Observed:** The full editor exposes location inheritance, saved pin, search, current location, map controls, coordinates and removal together. The saved location is represented repeatedly as coordinates.

**Improve:** Begin with Follow growing space or Set a separate location. For a separate location, show search and the saved place; expand the map for refinement. Put manual coordinates and removal under secondary controls. Keep the selected place name prominent and technical details secondary.

### 15. Reduce photo-flow overhead and clarify cover editing

**Observed/source:** Add photo opens an empty composer, then Choose photo launches selection. The gallery viewer combines caption editing, setting a cover, deletion and comparison controls. Compare choices use date text rather than image thumbnails.

**Improve:** Launch selection from Add photo, then show preview, date and caption. On native devices, offer Camera and Library where supported. Keep the viewer focused on the image and caption; place cover/deletion in an action menu and comparison in an explicit Compare flow with thumbnail choices. Make the cover image's editing path discoverable from the header.

## Priority 3 — simplify the screen and navigation

### 16. Shorten the opening stack and retain plant identity while scrolling

**Observed:** On mobile, the toolbar, identity card, tab rail, calendar controls, date-range text and seven day tiles precede the journal content. The tabs stick, but the plant identity scrolls away.

**Improve:** Keep the current identity card compact, reduce redundant calendar text, and show a small plant name in the sticky header after the card leaves view. Preserve existing independent scroll positions for the three tabs. Keep activity and advice above detailed weather.

### 17. Use fewer equally prominent containers

**Observed:** Rounded borders appear on the banner, badges, tabs, day tiles, advice, profile cards, inputs and actions. Details repeats facts already shown in the identity card and introduces another Plant profile heading.

**Improve:** Keep strong filled treatment for the selected tab and primary action. Use lighter dividers for quiet information and fewer nested bordered surfaces. Tighten repeated headings and facts while keeping the full profile understandable on its own. Keep generous touch targets while reducing decorative vertical space.

### 18. Normalize language and values

**Observed:** Add log, Record an activity, Save journal entry, Water/Watering, Feed/Feeding, Care routine/Care plan and Notes and history all occur. Section selectors expose values such as unknown, vegetative and none directly.

**Improve:** Use Add activity > Log watering > Save watering, and Edit activity > Save changes. Keep one name per profile section in the card and editor. Display friendly labels such as Unknown, Vegetative and No reminders while retaining internal values in data.

### 19. Match the back label to the real destination

**Source:** The back handler can return to a group, while the toolbar always says Garden and its accessibility label says Back to plants.

**Improve:** Show the actual destination, for example Back to Home or Back to plants. Preserve the collection/list context on return. Keep the visible and accessible labels aligned.

### 20. Make the first-plant handoff shorter

**Source-only:** New-plant success adds a welcome card with recording, photo and profile-review actions plus Got it. It can appear alongside the persistent footer and tab content.

**Improve:** Use a concise Plant added confirmation and one optional first action aligned with what is still missing. Avoid adding another persistent menu above the normal screen. Preserve existing initial photos/care so the handoff does not ask for work already done.

## Proposed flow

- Open plant -> compact identity -> Journal for today -> advice and recorded activities -> conditions.
- Record activity -> choose type -> essential fields, visible date and optional details -> save -> reveal the saved entry.
- Add photo -> choose source/image -> preview, taken-on date and caption -> save -> reveal the new photo.
- Edit plant -> choose profile section -> focused editor -> save -> return to the updated section at the same scroll position.
- Find history -> search text/category/date -> select result -> reveal the matching entry -> return to the retained results.
- Finish/manage grow -> Manage plant -> explicit lifecycle action -> review consequences -> confirm -> updated state and history.

## Implementation order

1. Canonical editing path, contextual footer and consistent labels.
2. Short activity forms, date pickers and deliberate draft recovery.
3. Search and advice-to-recording connections.
4. Lifecycle routing, save-result visibility and photo flow.
5. Visual density, sticky identity, onboarding and secondary controls.

Validate on a native device with the keyboard open, at narrow widths, and with populated history, older dates, failed saves and restored drafts. Browser/source findings above do not establish native-device behavior.
