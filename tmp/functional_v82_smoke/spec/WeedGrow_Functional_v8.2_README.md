# v8.2 functional handoff

The master specification is consolidated; section18 records exactly what was
completed and what still requires evidence/integration. The JSON contract is
the machine-readable companion. Start with the section18 tables.

The functional reference implements provider normalization, IANA daily bounds,
unknown-state/refill bounds, compatible transitions and display eligibility.
It reads captured payload fixtures locally. It makes no API requests or app
writes and sends no notifications. Tests run with Python3.10+; zoneinfo needs
IANA timezone data (available in the tested bundled runtime; Windows Python
deployments may need the tzdata package). No grower installs or supplies this.

Run the four test commands in master section18. For the older v7.4 emulator,
use its bundled independent test harness. The new helpers are not wired into
that frozen orchestrator or production app. All fixture coordinates/weather
are the public Johannesburg audit sample captured30October2026, not user
plant measurements. Plant-state test values are synthetic.

No scientific coefficients, approval records or accuracy targets were invented.
No new client facts, daily measurements, factor types or warning IDs were added.
Source products are preserved; archived forecasts do not become observations.
Unknown ranges remain unknown until supported profiles/state evidence exist.

The reference water feed uses Open-Meteo mappings with retained OpenWeather
support; commercial access and production activation are not configured by
this package. Read the source audit for exact live-payload evidence and known
defects still present in the app parser.
