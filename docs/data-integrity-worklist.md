# Code-design work — completed review

Scope: runtime read validation, loose types, bounded garden/backup operations, relationship integrity, async flows, shared UI foundations and one automatic verification command.

- [x] Decode plant/group/journal/weather/photo/profile data at read boundaries; report malformed records without silently presenting incomplete data.
- [x] Replace unchecked backup/configuration casts with guarded unknown values and shared codecs.
- [x] Bound live garden queries and export reads; decode restore records only within bounded chunks; enforce consistent file-size limits.
- [x] Make profile deletion and plant/group changes safe against concurrent references.
- [x] Standardize request lifecycle and stale-result protection for settings/search/profile operations.
- [x] Share palette/spacing/feedback foundations across the reviewed older screens.
- [x] Add a single local/CI verification command for types, lint, architecture, unit and emulator checks.

Additional defects discovered during the audit:

- [x] Plant deletion must stop new group membership before looking up groups to detach.
- [x] A profile deletion must stop new links before checking whether it is still referenced.
- [x] Validate saved restore destination plans before trusting them.
- [x] Align backup chooser, validator and exporter size limits.
- [x] Validate nested timestamp tags before the first restore write, not during a later chunk.
- [x] Repair unambiguous legacy backup membership backlinks and reject conflicting membership.
- [x] Reject invalid growing-space setup fields at the write boundary.
- [x] Avoid repeatedly registering motion-preference observers for every button.
- [x] Display pending garden totals instead of briefly reporting an unloaded collection as zero.
- [x] Validate weather provider responses and prevent incomplete hourly samples from producing an infinite peak temperature.
- [x] Remove the unused alternate cache and enforce explicit production types in the reviewed modules.

No billing changes, paid services, historical-weather rewrites or production data migrations are authorized by this work.
