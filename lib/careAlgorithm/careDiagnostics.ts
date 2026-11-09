import type { Evaluation } from './types';

export interface CareDiagnostic {
  source: 'backend' | 'local_fallback' | 'on_device'; status: string; checkedAtUtc: number; backendRevisionPresent: boolean;
  snapshotEvaluatedUtc?: number; snapshotExpiresUtc?: number; journalWeatherDays?: string[]; journalHistoryReadFailed?: boolean;
}
export interface CareReadResult { evaluation: Evaluation | null; diagnostic: CareDiagnostic }
export interface DiagnosticEntry { label: string; value: string }
const messages: Record<string, string> = {
  local_meteo_unavailable: 'Open-Meteo weather could not be loaded for this location. Refresh weather or use an explicit manual test.',
  local_meteo_stale: 'The Open-Meteo bundle is over one hour old or dated in the future. Refresh weather to recalculate.',
  local_meteo_current_hour_missing: 'The current hour has no usable ET0 or liquid-rain model estimate. Missing amounts are not treated as zero.',
  open_meteo_model_estimate: 'Water demand and rain use Open-Meteo model estimates, not a soil-moisture measurement. The editable plant profile remains experimental.',
  partial_hour_conditional_model_bounds: 'Current-hour timing is bounded by zero and the full predicted hourly amounts. These are conditional model bounds, not validated bounds on weather forecast error.',
  local_test_inputs_required: 'Choose Use Open-Meteo weather, Dry test or Rain test in Algorithm controls, or enter your own test profile and weather rates. The calculation runs on this device.',
  local_test_settings_invalid: 'The local test parameters are invalid. Check Algorithm controls.',
  local_test_window_too_long: 'This test started more than 14 days ago. Reset its start time in Algorithm controls.',
  local_test_anchor_future: 'The test start is in the future. Reset its start time or check the device clock.',
  local_test_location_changed: 'The plant moved after this test started. Reset the test start to use its current setup.',
  local_journal_read_failed: 'Watering records could not be loaded. Retry; missing records are not treated as an empty journal.',
  unsupported_environment: 'The current water model supports outdoor plants. Indoor and greenhouse estimates require a separate model.',
  date_occurrence_zone_or_day_unknown: 'A watering record has no usable date or timezone. Correct that record, or exclude recorded watering for a controlled experiment.',
  invalid_watering_amount: 'A watering record has an invalid amount. Correct its quantity before including it in the calculation.',
  unsupported_volume_domain: 'The pot volume is missing, ambiguous or outside the profile range. Add an explicit volume and unit in Growing setup.',
  server_evaluation_missing: 'No backend watering evaluation has been published for this plant. Recorded journal weather alone does not create a watering evaluation.',
  server_evaluation_not_loaded: 'The plant references a backend watering result, but that result has not been loaded.',
  server_snapshot_missing: 'The plant references a backend watering result, but its snapshot document is missing.',
  server_evaluation_expired: 'The stored backend watering result has expired. A fresh backend evaluation is required.',
  server_snapshot_revision_mismatch: 'The stored watering result does not match the latest backend revision for this plant.',
  server_snapshot_input_changed: 'The stored watering result uses older plant setup or watering-log inputs. It needs to be recalculated.',
  server_snapshot_location_mismatch: 'The stored watering result belongs to an older location revision.',
  server_snapshot_engine_unsupported: 'The stored watering result uses an unsupported algorithm version.',
  server_snapshot_future_evaluation: 'The stored watering result is dated in the future. Check the device clock and backend timestamps.',
  server_snapshot_invalid: 'The stored backend watering result is malformed or lacks required decision metadata.',
  server_snapshot_release_invalid: 'The stored definite watering result lacks matching release approval metadata.',
  server_snapshot_read_permission_denied: 'Access to the backend watering snapshot was denied. Check the signed-in account and deployed Firestore rules.',
  server_snapshot_read_unavailable: 'The backend watering snapshot could not be reached. Check the connection and retry.',
  server_snapshot_read_failed: 'The backend watering snapshot could not be read. The underlying error has a separate diagnostic code.',
  profile_unavailable: 'The backend has no watering profile for this setup.',
  profile_not_approved: 'The selected watering profile has no matching release approval.',
  approved_profile_domain_unavailable_or_ambiguous: 'No unique approved watering profile matches this setup.',
  history_gap: 'The watering estimate is unavailable because required hourly ET0 or liquid-rain history is incomplete. Daily journal weather summaries do not fill that gap.',
  water_history_acquisition_unavailable: 'The watering-history provider request failed. The backend needs to retry it.',
  history_backfill_pending_or_budget: 'Watering history backfill is pending, rate-limited or has exhausted its configured request budget.',
  water_origin_initialized_unanchored: 'The backend has just initialized an unknown water reserve and cannot yet establish a definite watering decision.',
  unsupported_source_domain: 'The selected weather source is outside the watering profile’s supported source domain.',
  water_setup_history_not_synchronized: 'The dated setup/profile history does not yet match the current plant setup.',
  event_source_not_synchronized: 'The backend watering ledger has not yet caught up with the current watering logs.',
};
export function careCodeMessage(code: string): string | null { return Object.hasOwn(messages, code) ? messages[code] : null; }
export function safeCareCodes(codes: readonly string[]) { return [...new Set(codes.filter(c => typeof c === 'string' && /^[a-z0-9_]{1,100}$/.test(c)))].slice(0, 32); }
const stamp = (value: number | undefined) => {
  const date = typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : 'Not available';
};
export function careDiagnosticEntries(e: Evaluation | undefined, diagnostic: CareDiagnostic | undefined, nowUtc: number): DiagnosticEntry[] {
  const entries: DiagnosticEntry[] = [];
  if (e?.execution === 'local-experimental') {
    entries.push({ label: 'Result source', value: 'On-device experiment — no backend required' },
      { label: 'Evaluated at (UTC)', value: stamp(e.evaluationUtc) }, { label: 'Valid until (UTC)', value: stamp(e.nextEvaluationUtc ?? undefined) },
      { label: 'Profile', value: 'Editable test parameters; not a calibrated hops release' });
    const inputs = e.localInputs;
    if (inputs) entries.push({ label: 'Test start (UTC)', value: stamp(inputs.anchorUtc) },
      { label: 'Water forcing', value: inputs.weatherMode === 'open-meteo' ? 'Open-Meteo hourly model ET0 and liquid rain. Current-hour timing is bounded conditionally; not field measurements.' : `Assumed constant ET0 ${inputs.et0MmPerDay} mm/day and rain ${inputs.rainMmPerDay} mm/day; not measured weather history` },
      { label: 'Starting reserve', value: `${inputs.initialReserveL} L (test assumption)` },
      { label: 'Watering records', value: inputs.includeJournal ? `${inputs.journalEntries} selected journal entries` : 'Journal excluded for this experiment' },
      { label: 'Extra simulated water now', value: `${inputs.extraWaterL} L` });
    if (inputs?.weatherMode === 'open-meteo') entries.push({ label: 'Weather acquired (UTC)', value: stamp(inputs.weatherRetrievedUtc) });
    for (const scenario of e.water.evidence?.scenarios ?? []) entries.push({ label: 'Estimated reserve', value: `${scenario.reserveL[0].toFixed(3)}–${scenario.reserveL[1].toFixed(3)} L; threshold ${scenario.actionReserveL} L` });
    const codes = safeCareCodes(e.water.reasonCodes);
    if (codes.length) entries.push({ label: 'Reason codes', value: codes.join(', ') });
    for (const [index, code] of codes.entries()) { const message = careCodeMessage(code); if (message) entries.push({ label: `Detail ${index + 1}`, value: message }); }
    return entries;
  }
  const codes = safeCareCodes([...(diagnostic && diagnostic.status !== 'backend_evaluation_available' ? [diagnostic.status] : []), ...(e?.water.reasonCodes ?? [])]);
  if (codes.length) entries.push({ label: 'Reason codes', value: codes.join(', ') });
  entries.push({ label: 'Result source', value: diagnostic?.source === 'backend' ? 'Protected backend evaluation' : 'Local unavailable fallback' });
  if (diagnostic) entries.push({ label: 'Backend pointer', value: diagnostic.backendRevisionPresent ? 'Present' : 'Missing — no published result linked to this plant' });
  entries.push({ label: 'Checked at (UTC)', value: stamp(diagnostic?.checkedAtUtc ?? nowUtc) });
  entries.push({ label: 'Backend evaluated at (UTC)', value: stamp(diagnostic?.snapshotEvaluatedUtc ?? (diagnostic?.source === 'backend' ? e?.evaluationUtc : undefined)) });
  entries.push({ label: 'Backend expiry (UTC)', value: stamp(diagnostic?.snapshotExpiresUtc ?? (diagnostic?.source === 'backend' ? e?.nextEvaluationUtc ?? undefined : undefined)) });
  if (diagnostic?.journalWeatherDays) {
    entries.push({ label: 'Journal weather entries', value: `${diagnostic.journalWeatherDays.length} date(s) in this read${diagnostic.journalWeatherDays.length ? ': ' + diagnostic.journalWeatherDays.join(', ') : ''}` });
    entries.push({ label: 'Journal weather format', value: 'Daily display summaries; not the canonical hourly ET0/rain history used by the water model' });
  }
  if (diagnostic?.journalHistoryReadFailed) entries.push({ label: 'Journal read', value: 'Failed — displayed coverage could not be checked' });
  if (e) {
    entries.push({ label: 'Engine', value: e.engineVersion });
    entries.push({ label: 'Profile version', value: diagnostic?.source === 'backend' ? e.profileVersion ?? 'No profile selected by backend' : 'Not evaluated by backend' });
  }
  const gap = e?.water.coverageIssue;
  if (gap) {
    entries.push({ label: 'Affected forcing', value: `${gap.variable} · ${gap.cause}` });
    entries.push({ label: 'First unsupported interval (UTC)', value: `${stamp(gap.fromUtc)} → ${stamp(gap.toUtc)}` });
  }
  const known = codes.map(careCodeMessage).filter((m): m is string => !!m);
  for (const [index, value] of known.entries()) entries.push({ label: `Detail ${index + 1}`, value });
  return entries;
}
