import { careDiagnosticEntries, safeCareCodes } from '../careDiagnostics';
import { calculatePlantWatering } from '@/lib/suggestions/wateringEngine';
import { makePlantSummary, makeWeatherEntry } from '@/lib/suggestions/__tests__/fixtures';
import { buildSuggestionCardsFromInsight } from '@/lib/suggestions/suggestionCards';
import { evaluateCare } from '../evaluate';
import { profile, setup, source, sample } from './helpers';
import { waterExplanation } from '../waterExplanation';
import type { WeatherSample } from '../types';
jest.mock('@/lib/suggestions/wateringSuggestions', () => ({ evaluateWateringInsights: jest.fn() }));
test('journal weather with missing backend evaluation gives publication diagnostics, not a false missing-day diagnosis', () => {
  const plant = makePlantSummary(); const date = new Date('2026-11-06T12:00:00Z');
  const range = Object.fromEntries(['2026-11-04', '2026-11-05', '2026-11-06'].map(day => [day, { logs: [], weather: makeWeatherEntry(day) }]));
  const insight = calculatePlantWatering(plant, date, { lookbackDays: 6, rainfallThresholdMm: 8 }, range)!;
  expect(insight.careDiagnostic).toMatchObject({ status: 'server_evaluation_missing', journalWeatherDays: ['2026-11-04', '2026-11-05', '2026-11-06'] });
  const card = buildSuggestionCardsFromInsight(insight, date).find(c => c.kind === 'watering')!;
  expect(card.summary).toContain('No backend watering evaluation');
  expect(card.summary).not.toContain('history is incomplete');
  expect(card.diagnostics).toContainEqual({ label: 'Reason codes', value: 'server_evaluation_missing' });
  expect(card.diagnostics?.some(d => d.label === 'Journal weather entries' && d.value.startsWith('3 date'))).toBe(true);
  expect(card.diagnostics).toContainEqual({ label: 'Profile version', value: 'Not evaluated by backend' });
});
function evaluated(weather: WeatherSample[]) {
  return evaluateCare({ setup, profile, evaluationUtc: 7200, nextEvaluationUtc: 8000, policyVersion: 'test', warningWindows: [],
    approvedProfiles: { [`${profile.id}@${profile.version}`]: { profile, approvalRecordId: 'TEST-ONLY' } },
    replay: { anchorUtc: 0, anchored: true, et0Source: source, rainSource: source, events: [], weather } });
}
const second = { valid_start_utc: 3600, valid_end_utc: 7200 };
test('actual missing ET0 reports the first missing interval, even when rain is complete', () => {
  const e = evaluated([sample('et0_mm', 1), sample('liquid_rain_mm', 0), sample('liquid_rain_mm', 0, second)]);
  expect(e.water.coverageIssue).toEqual({ variable: 'et0_mm', cause: 'gap', fromUtc: 3600, toUtc: 7200 });
  expect(e.water.needsWater).toBeNull();
  const details = careDiagnosticEntries(e, { source: 'backend', status: 'backend_evaluation_available', checkedAtUtc: 7300, backendRevisionPresent: true }, 7300);
  expect(details).toContainEqual({ label: 'Affected forcing', value: 'et0_mm · gap' });
  expect(details.find(d => d.label === 'First unsupported interval (UTC)')?.value).toBe('1970-01-01T01:00:00.000Z → 1970-01-01T02:00:00.000Z');
});
test('missing rain value is distinct from a missing time interval', () => {
  const e = evaluated([sample('et0_mm', 1), sample('et0_mm', 1, second), sample('liquid_rain_mm', null), sample('liquid_rain_mm', 0, second)]);
  expect(e.water.coverageIssue).toEqual({ variable: 'liquid_rain_mm', cause: 'missing_value', fromUtc: 0, toUtc: 3600 });
});
test('raw error messages and arbitrary URLs cannot become diagnostic codes; extreme dates cannot crash formatting', () => {
  expect(safeCareCodes(['history_gap', 'history_gap', 'https://secret?key=value', '<script>'])).toEqual(['history_gap']);
  expect(() => careDiagnosticEntries(undefined, { source: 'local_fallback', status: 'server_snapshot_invalid', checkedAtUtc: 1e300, backendRevisionPresent: true }, 7300)).not.toThrow();
});
test('publication failures take precedence over placeholder profile errors', () => {
  expect(waterExplanation({ needsWater: null, decision: 'uncertain', reasonCodes: ['profile_unavailable', 'server_evaluation_missing'] })).toContain('No backend watering evaluation');
});
