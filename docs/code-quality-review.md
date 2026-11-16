# Code quality review — 16 November 2026

This pass reviewed the repository's structure, data boundaries, shared stores, home and care flows, and the larger plant-detail, journal-composer and plant-creation modules. Implementation focused on changes with clear behavioral coverage on `codex/ui-refinement`.

## Existing foundations

- Feature folders separate screens, components, hooks and repository APIs. Shared UI, data services and pure domain calculations already have dedicated locations.
- ESLint and `scripts/test-architecture.cjs` enforce database boundaries for screens/hooks and keep presentation dependencies out of services and domain calculations.
- `createLiveStore` shares account/query subscriptions across consumers. `listenPagedQuery` publishes complete inventories and invalidates following pages when their boundary changes. Multiple `usePlantList` consumers therefore do not, by themselves, imply duplicate database listeners.
- Journal and plant mutation APIs handle transactions, retry identity, competing writes and ownership. These are useful domain boundaries to retain.
- The starting baseline passed backend/app types, lint, architecture checks, 151 Jest suites / 1,353 tests, and the local Firebase integration checks.

## Changes made

### Remove disconnected legacy code

Removed `useHomeScreenState`, `useGroupList`, `useGroupListHandlers`, `useGroupListFilters` and `useGroupPlantsMap`. Their only remaining references formed an unused chain from the former group-list home screen. The current home screen uses the garden selector and shared collection stores directly.

Removed the home screen's write-only scroll-offset ref. Actual scroll position remains managed by `homeGardenView` and `PlantListScreen`.

### Separate care orchestration from presentation

`useGardenCareSuggestions` now owns evaluation, cancellation, request identity, focus refresh, local-care setting changes, day changes and expiry timers. `GardenCareOverview` owns disclosure state and rendering; `gardenCareGroups` remains the pure grouping function.

The former minute-based evaluator reread care inputs for every active plant each minute. The new hook preserves results across ordinary minute ticks and unrelated note edits. It refreshes when relevant inputs change, the screen regains focus, the plant's local day changes, the user retries, or a returned evaluation/card expires. Already-expired responses do not create a rapid retry loop.

Late results from an old garden cannot replace the current garden's results. Empty/inactive/deleting scopes skip evaluation. Incomplete results continue to expose retry rather than an all-clear state.

### Avoid sorting for counts

`countPlantList` and `selectPlantList` share one filter predicate. Home counts and filter previews use the counting path, so they no longer allocate a sorted result or compare creation timestamps just to display a count. Actual list sorting and tie-breaks remain unchanged.

### Index garden membership once

`summarizeGardenCollection` computes active counts and the unassigned count with a plant index and membership sets. Work scales with plants plus stored membership entries, instead of scanning the full plant collection for each garden and searching every garden for each unassigned plant.

This retains legacy array-only membership, ignores stale reverse membership for plants assigned elsewhere, avoids duplicate membership counts within one garden, and retains the previous treatment of past/deleting plants in these counts.

### Consolidate view persistence

Home uses one `restoreView` callback for initial loading, selection, fallback and scope restoration, plus one selection-persistence helper. Per-account storage keys, ordered writes, garden-specific filters and scroll memory remain in place.

## Further modularization candidates

- `PlantDetailScreen.tsx` combines journal/date navigation, scroll restoration, care evaluation, photo loading and lifecycle panels. Separate its navigation/scroll state and care orchestration in later focused changes, with return-navigation and date-selection regression coverage.
- `PlantLogComposer.tsx` combines form rendering with journal submission and reconciliation. Its retry and mutation identity rules should remain together when submission state moves into a dedicated hook.
- `AddPlantFlow.tsx` and `components/FlowSteps.tsx` are the next substantial UI modules to split by step and navigation responsibility. Preserve draft flushing, validation focus, account transitions and duplicate-save guards during that work.
- `PlantSummary` currently requires a complete `Plant`, while `adviceInput` deliberately projects only evaluation-relevant fields. A later type-focused pass should define the precise care-input contract across the evaluator and local-care services, rather than adding more casts at each consumer.

These candidates are follow-up work, not confirmed defects. No repository-wide rewrite or native-device performance benchmark is claimed. SOLID is applied here through focused responsibilities, narrow component/service boundaries and reuse of existing domain APIs; additional class hierarchies would not improve these React functions.

## Regression coverage

New coverage checks count/list equivalence without timestamp reads; legacy, duplicate and stale garden membership; minute-tick request reuse; relevant-input invalidation; expiry refresh and timer cleanup; late request cancellation; partial failure/retry; empty scopes; and expired-response retry suppression. Existing overview disclosure/navigation tests and filter-menu tests remain in the verification suite.

Final `npm run verify` passed: backend types/build, app types, lint with zero warnings, architecture policy, 152 Jest suites / 1,361 tests, and all local Auth/Firestore integration, concurrency, efficiency and ownership checks. `git diff --check` also passed. No native-device UI or performance benchmark was run in this pass.

## Second pass — disconnected code and small simplifications

The follow-up scan traced imports, re-exports and literal dynamic references across application routes, features, shared UI, hooks, services, domain code, tests, scripts, backend source and MCP tool source. Repository text searches cross-checked the retired entry points. Files with platform-specific counterparts were protected during candidate selection.

Removed 80 disconnected source files, approximately 5,400 lines, in these families:

- The retired seven-step add-plant screens, their exclusive forms, step hooks, types, layout components, placeholder APIs and unused API forwarders. The active `AddPlantFlow` / `FlowSteps` implementation remains the creation entry point.
- The former group-list home components and superseded group-detail and plant-header/gallery components.
- Unused log/history hooks and their exclusive fetch helpers.
- The disconnected weather-advice heuristic and fetch/freshness helpers. Current care evaluation and weather collection continue through their existing services.
- Shared input/card/animation wrappers whose only consumers belonged to those retired screens, plus other UI components without callers.

Existing regression tests were retained. Active compatibility exports, shared stores, notification consumers, platform implementations and mutation services were preserved. This removes competing implementations and unused dependencies between modules without redesigning active screens or introducing a new abstraction layer.

Two small changes simplify active code:

- `mapConcurrent` uses its already-validated positive integer pool size directly instead of flooring and clamping it again. Existing bounds, ordering and concurrency behavior are retained. Added coverage checks invalid pool sizes, empty work and a pool larger than its input.
- Bulk watering totals use one reduction over the existing results instead of three filtered arrays. Daily duplicate handling, partial failures, retry identity and the returned count fields are unchanged and remain covered by the existing tests.

Second-pass validation passed: complete `npm run verify` (152 suites / 1,367 tests, backend/app types, backend build, zero-warning lint, architecture policy and all local Firebase integration checks), production web export including 24 static routes, and `git diff --check`. Native-device behavior and performance were not benchmarked.
