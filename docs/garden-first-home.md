# Garden-first Home: initial UI implementation

Implemented 27 October 2026 as a focused slice of the [broader design spec](garden-first-design-spec.md).

## Included

- Home opens on a garden's plants, without the Groups / Plants swipe tabs.
- A compact cream garden header retains the existing Grove visual language and opens an anchored dropdown.
- The dropdown switches gardens, remembers an explicit selection per account/device, provides All plants for legacy/unassigned records, and offers garden creation.
- Garden creation needs only a name and environment; location can follow later. Stable request IDs protect retries.
- Search and status filters apply to the selected garden. Existing plant cards, quick watering, journal/photos/details, and bottom navigation are retained.
- Add plant carries the selected garden into the existing five-step flow and prefills its shared setup. Resuming an older draft retains that draft's garden.
- Garden tools links to the existing group management/watering screen. This preserves access without rebuilding management in this pass.

## Deliberately deferred

No existing plants are reassigned automatically. Required garden membership, storage/rules migration, shared-setting inheritance changes, active/history capacity changes, bulk feeding/resumable batches, four-step creation, and Home / Care / More navigation remain proposals in the broader spec.

The garden tools screens retain existing group terminology and behavior. All plants remains an explicitly labelled compatibility browse option. The current group watering limits still apply.

## Verification

- TypeScript, ESLint with zero warnings, architecture checks, and whitespace checks passed.
- Full Jest run: 73 suites / 354 tests passed. New tests cover membership isolation with stale indices, preference recovery, garden-creation retries/ownership, and draft destination preservation.
- Browser review covered desktop, 320 px and 390 px mobile widths; dropdown selection and persistence after reload; scoped search/empty results; existing plant navigation and return; Add Plant entry context; and garden creation form layout.
- Browser inspection did not save plants, care records, or new gardens. Creation write behavior was checked through isolated mocked repository tests; live/native end-to-end creation is not claimed.
- Native device keyboard/back behavior remains to be checked on a physical device.
