# Location picker — 20 October 2026

The same location form is available in Add Plant, the plant location section editor, the full Edit Plant screen, and the older edit modal/location flow. Selecting search results moves a draggable map pin. Clicking or tapping the map (or using the keyboard-accessible center button) changes the coordinates and resolves the nearest town/area back into the search/name field. An optional personal nickname is kept separate.

## Services and cost

- Leaflet 1.9.4 renders the map. Web loads it from the installed package; Android/iOS use the existing WebView dependency with pinned, integrity-checked Leaflet assets from unpkg. Native does not require a Google Maps API key.
- OpenStreetMap standard tiles provide the basemap. Attribution stays visible, HTTP caching is left intact, requests cover the interactive viewport, and no offline download feature is provided. Public tiles have best-effort availability and usage limits; see https://operations.osmfoundation.org/policies/tiles/ .
- Forward and reverse town geocoding reuse the already configured OpenWeather key. No new service account, subscription, billing link or paid plan was enabled. Existing provider quotas apply. This is town/area search, not full street-address or business autocomplete.

## Reliability and privacy

- Only explicit searches issue forward requests. Reverse lookup waits 450 ms after a pin is selected, with a 10-second timeout, a bounded one-hour memory cache and cancellation/version checks.
- The exact coordinates are retained independently of the nearest area's returned coordinates. Failed or empty name lookup leaves a coordinate label and a usable pin.
- Clearing the location, choosing a result, typing a new search and unmounting retire pending work. Old responses cannot restore a cleared pin or overwrite a newer selection.
- GPS permission is requested only by the current-location button. Town/region search needs no GPS permission. Map providers receive requested map areas; OpenWeather receives submitted searches and pin coordinates. Plant persistence still happens through the existing save flow (Add Plant also keeps its local draft).
- Coordinate fallback rejects blank, partial, nonfinite and out-of-range values. Zero coordinates remain valid. Search results are validated before display.

## Verification

- Browser: search Cape Town, choose the result, verify the pin/tiles, then click a different point and verify reverse lookup updates the name without snapping the exact pin to the town center. Form changes are cancelled during QA rather than assigning a made-up location to the user's plant.
- Regression tests cover coordinate validation, malformed results, lookup caching/failure, out-of-order reverse results and clearing during an in-flight search.
- Local Firebase workflow checks persistence of exact coordinates/label and clearing a saved location.
- TypeScript, lint and the complete Jest suite pass. Physical Android/iOS map rendering, GPS permissions and gesture handling still require device QA.

## Device location and feedback follow-up

Fixed an indefinite wait in the old browser path: Expo's permission helper calls `getCurrentPosition` without a timeout before the app's position deadline starts. Web now uses a single browser position request with a 15-second overall deadline, cancellation, a one-minute maximum cache age, and distinct blocked/unavailable/timeout messages. Native likewise bounds both permission and positioning, and checks whether device location services are enabled. No IP-based location service or new paid service is used.

The shared form now provides immediate spinners, a visible status/error panel beside the location controls, cancellation, search result counts, success feedback and device-reported accuracy. Map imagery has its own progress indicator and timeout/retry. The map height adapts to the available screen height; narrow controls and coordinate fields fit the actual form width. Privacy details are collapsible.

Verified the browser's actual unavailable-position case: progress appears immediately, then the deadline releases the controls with an explanation. Also checked a 390 × 844 viewport: document width remains 390 pixels, the map fits within the modal, and Save stays outside the scrolling body. Browser/OS access still determines whether an actual position can be obtained; the app cannot grant itself that access. Unit tests simulate successful positioning, blocked/unavailable services, permission prompts that never answer, cancellation and ignored late results. 21 suites / 189 tests pass, plus type checking and lint.
