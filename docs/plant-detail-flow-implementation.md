# Plant flow implementation — 27 October 2026

Implements the [20-point flow audit](plant-detail-flow-audit-2026-10-27.md).

| Audit items | Result |
| --- | --- |
| 1. Contextual actions | Journal prioritizes Add activity with a labeled photo action. Photos prioritizes Add photo with a secondary Log today action. Details uses its section edit buttons and has no competing logging footer. Inactive plants point to management instead of offering a save that would fail. |
| 2. Canonical editing | Banner Edit plant opens a section chooser. All sections use the same editor, including care, profile notes, start/age and location. Legacy `/edit` links redirect into this system. |
| 3. Short logging forms | Activity selection leads to a compact task form. Water amount or nutrient dose precedes optional observations. Other measurements are disclosed on demand. Task-specific save labels and a fixed footer keep completion visible. |
| 4. Dates | Shared calendar fields replace typed dates in activity, photo, profile, search and harvest forms. Older photo capture dates are saved atomically with their journal dates in the plant's time zone. Journal history supports records predating app registration. Photos and activity forms show the actual target day. |
| 5. Advice | The highest-priority recommendation is visible directly, other notes are optional, repeated explanation text is removed, and contextual observation actions lead into recording. Advice never automatically records watering. |
| 6. Search | Automatically loads every page in the chosen range, defaults to 30 days, filters observations/activities/measurements, labels incomplete failed searches, and supports retry. Results open and highlight their exact entry. A return-to-results action retains filters. Bounds use plant-local dates. |
| 7. Lifecycle | Archive, restore, mark dead, harvest and permanent deletion live in Manage plant. Status is no longer editable through Basics. Harvest uses the shared dated editor and the existing atomic harvest repository. Destructive actions retain confirmations. |
| 8. Consistent editors | Shared mobile sheet, active theme, keyboard avoidance, fixed save area and close controls. Profile/photo/harvest changes retain discard guards; activity close keeps its explicit local draft. |
| 9. Draft recovery | Activity recovery offers Resume or Start new instead of silently replacing the requested date/type. Discard appears only for meaningful edits. Existing photo drafts can be opened before selecting another image. Other editors share themed recovery controls. |
| 10. Save destinations | Profile saves return to the edited section; activity saves highlight their record; photo saves reveal their new photo. Backdated photos are pinned after saving even if older than the first gallery page. Feedback identifies the task/date. |
| 11. Notes | Profile notes and dated journal observations use distinct labels and explanations. |
| 13. Age | Known start date and estimated age are mutually exclusive editing modes with a preview. Unrelated edits preserve existing estimated start dates and do not invent dates for legacy recorded ages. |
| 12. Reminders | Consistent Care routine naming, weekday chips, hour/minute selection, schedule preview and notification guidance when reminders are enabled. |
| 14. Location | Search/place first, optional map refinement and secondary coordinate/removal controls. Saved nickname is prominent; raw coordinates no longer prefill the compact search field. Themes extend through location controls. |
| 15. Photos | Browser Add photo opens selection directly when no draft needs recovery. Native supports Library and Camera. Preview includes capture date and caption. Viewing separates caption editing, photo actions and thumbnail comparison. Cover editing is discoverable from the header. |
| 16–17. Density | Smaller identity treatment, compact weekly navigation, no duplicate profile introduction, quieter profile dividers and sticky plant identity. Narrow calendar labels avoid wrapping. |
| 18–19. Language/navigation | Consistent activity and profile section labels, friendly selector values and back labels matching the destination type. |
| 20. New-plant handoff | Concise saved confirmation and dismissal, without another action menu repeating the normal interface. |

## Validation

- `npm run verify` passed: TypeScript, lint, architecture boundaries, 66 suites / 305 tests, and local Firebase integration/ownership checks.
- Local Firebase integration and ownership checks; new assertions cover dated photo creation, retry date correction, matching journal timestamps and search visibility.
- Browser review at 390px and 320px, Grove and Daylight: activity picker/form, invalid numeric validation, closing/recovering/discarding an activity draft, section chooser, reminder controls and unsaved-change guard, location editor, search range selection, historical result highlighting and editing, and harvest entry.
- No production plant, log, photo or lifecycle changes were made during review. Mutation checks run against the local demo Firebase project.

Physical-device keyboard, camera permission and capture behavior still require native-device validation. Browser review does not establish those platform-specific results.
