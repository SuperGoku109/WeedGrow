# Plant care chart and reminder additions

Implemented 10 November 2026, using the Plant Parent screenshots as product references. New guidance is general outdoor gardening content.

## Available flows

- Plant Detail → **Plant info** → **Water / History and care** opens a chart and guide with 7, 30 or 90 days of saved journal records. Bars show recorded millilitres; categorical markers show user-reported Dry/Moist/Wet checks. Unknown amounts stay unknown and missing days remain gaps. Readable daily rows accompany the plot. Loading failures offer retry separately from an empty history.
- Add Plant → **Site & container**, or edit **Growing setup**, stores pot material, pot style, drainage and site. Options include fabric/grow bags, unglazed terracotta, glazed ceramic, hanging containers, self-watering containers, window boxes, balconies, patios, terraces and rooftops. Ground planting clears container details. Actual sun and rain exposure remain explicit facts.
- Add Plant → **Reminders**, or edit **Care plan**, provides independent Off / Smart / Custom choices for watering and fertilizing. Custom schedules support a 1–365 day interval or selected weekdays and a local time. Existing frequency settings retain their behavior until replaced by an explicit mode. Switching one kind does not overwrite the other.
- Smart watering uses the existing observation-driven outdoor inspection engine and avoids an additional repeating calendar watering alert. It schedules soil checks, not automatic watering instructions.
- Smart feeding reviews use a user-entered product-label interval and feeding history. A fresh soil-check plan can defer a review by at most one day beyond its calendar due date. This bounded adjustment cannot postpone reviews indefinitely. The app does not infer fertilizer doses or nutrient needs from weather.
- Fertilizer form is recorded separately (liquid, granular, slow-release or other). Fertilizer labels supply repeat intervals; the app does not assume one universal interval for a formulation.

## Integration and limits

No new dependencies, Firestore collections or weather fetch path were added. Charts reuse the account-scoped journal store. Optional metadata and schedules are validated on save, decode and JSON backup import. Drafts preserve unfinished choices while save-time validation rejects incomplete schedules. Changes to pot/site facts invalidate learned context, without adding unsupported material-to-watering coefficients.

Phone alerts require the existing global care-reminder preference and OS permission. Web does not deliver native notifications. Smart plans refresh while the app runs; previously scheduled native date notifications can deliver afterward. There is no new background weather service. Physical-device delivery and field accuracy remain separate from automated tests.

The chart displays observations and care history, not a predicted annual water-demand curve or an optimal water-volume prescription. The guide provides checks, drainage/reservoir context, and access to the existing soil-report workflow. It does not diagnose a disease from a photograph.

## Verification coverage

New tests cover chart rendering/range controls/error state, unknown volumes and gaps, timezone/date-only grouping, duplicate/future records, independent modes, native feeding-review content, bounded/stale evaluation handling, label-interval validation, context invalidation, draft recovery, creation persistence and backup retention. The local Firebase workflow also persists the metadata and verifies it through real garden export alongside observation edit/delete behavior.

Final verification: 123 Jest suites / 1,071 tests pass; root and backend type checks, backend build, lint, architecture checks, local Auth/Firestore integration, and Expo web export pass. Native delivery on a physical phone and a signed-in visual walkthrough were not performed.

## General gardening references

Original guide text links to [University of Saskatchewan outdoor container watering](https://gardening.usask.ca/articles-and-lists/articles-how-to/how-to-water-outdoor-containers.php), [Colorado State Extension container gardens](https://extension.colostate.edu/resource/container-gardens/), and [University of Maryland Extension container gardening](https://www.extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables).
