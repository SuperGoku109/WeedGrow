# Wind preparation policy

The standard weather screen warns at sustained wind >= 40 km/h (40/3.6 m/s)
OR gusts >= 60 km/h (60/3.6 m/s). Both evaluation paths use the shared policy.
Early-growth plants use >= 30 km/h sustained OR >= 45 km/h gusts instead.
Below both applicable limits there is no wind-preparation card, even with ordinary rain.
These are general preparation heuristics, not validated plant injury thresholds.

## Age and growth stage

Recorded germination, seedling or clone stage selects the early-growth screen.
If stage is unknown, a usable recorded age of 0–14 days selects it as a fallback.
The 14-day window and lower speeds are explicit product heuristics; the sources
below do not establish those numerical thresholds or a universal maturity date.
A recorded seedling stage stays on the early-growth screen after day 14.
Known vegetative/flowering stage takes precedence over the age fallback.

Age uses the sprouted/rooted start date and evaluation day in the plant timezone
(UTC if unavailable/invalid). An estimated age without a start date is usable
only with ageRecordedAt, and advances by elapsed calendar days. Undated legacy
estimates, future/invalid dates and explicitly unknown ages do not imply youth.
The setup fingerprint includes these age inputs so edits invalidate old results.
App creation date and location changes are not assumed to be birth/transplant dates.

Tender transplants may be vulnerable before acclimation, but the app has no
structured hardening-off or transplant-date records. It does not invent them.
Small height alone does not imply fragility: tall/top-heavy plants also face
windrock. Greater age/height therefore never raises the standard threshold.
Learn why explains the chosen screen, age/stage basis, and applicable limits.

Rationale: Met Office Beaufort guidance places strong mean winds around this
sustained threshold. Beaufort describes mean wind, so the separate gust screen
is a product decision, not a Beaufort classification of gusts. RHS notes that
exposed balconies and lightweight containers can be vulnerable in strong winds.
There is no defensible universal tipping/damage speed: shelter, container mass,
shape and support condition matter. We do not fabricate these inputs or reduce
the threshold solely because the plant is on a balcony.

Sources reviewed 2026-11-11:
- https://weather.metoffice.gov.uk/guides/coast-and-sea/beaufort-scale
- https://www.rhs.org.uk/garden-design/roof-gardens-balconies
- https://lancaster.unl.edu/hardening-transplants/
- https://yardandgarden.extension.iastate.edu/how-to/selecting-hardening-and-planting-bedding-plants
- https://www.rhs.org.uk/plants/types/hedges/windbreaks-shelterbelts

The outdoor evaluator accepts forecast signals only within the next 24 hours,
requires weather retrieved less than one hour ago, rejects invalid/missing wind
values and mismatched locations, and labels forecasts separately from recent
model estimates. Recent hazard signals can remain relevant for six hours;
they are not described as live sensor measurements. The card reports wind type
and km/h; Learn why provides the source and local timestamp.

Lower wind values may still contribute to the separate drying context; that
does not trigger a securing warning. Notification deduplication remains in
place, including the existing extreme escalation at 30 m/s (108 km/h).
The weather screen does not claim observed damage or a guaranteed safe limit.
