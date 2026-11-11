import { windPlantContext, windThresholds } from '../windPolicy';
import { evaluateOutdoorCare } from '../outdoorIntelligence';
import { plantSetup } from '../appAdapter';
import { evaluateCare } from '../evaluate';
import { weatherCards } from '../weatherCards';
import { sample } from './helpers';
import { makePlantSummary } from '@/lib/suggestions/__tests__/fixtures';

const now = Date.parse('2026-11-11T12:00:00Z') / 1000;
test.each(['germination', 'seedling', 'clone'])('recorded %s stage uses the early-growth screen even without age', growthStage => {
  expect(windThresholds({ growthStage }, now)).toMatchObject({ sustainedMs: 30 / 3.6, gustMs: 45 / 3.6, basis: 'early_growth_stage' });
});
test('age fallback advances with the calendar and does not assume a universal maturity date', () => {
  const context = { growthStage: 'unknown', startedOn: '2026-10-28', timeZone: 'Africa/Johannesburg' };
  expect(windThresholds(context, now)).toMatchObject({ ageDays: 14, basis: 'young_recorded_age' });
  expect(windThresholds(context, now + 86400)).toMatchObject({ ageDays: 15, basis: 'standard_or_unknown' });
  expect(windThresholds({ ...context, growthStage: 'seedling' }, now + 86400).basis).toBe('early_growth_stage');
  expect(windThresholds({ ...context, growthStage: 'vegetative' }, now).basis).toBe('standard_or_unknown');
});
test('recorded estimates must have a timestamp, and elapsed days are included', () => {
  expect(windThresholds({ ageDays: 3 }, now).ageDays).toBeNull();
  expect(windThresholds({ ageDays: 3, ageRecordedAtUtc: now - 20 * 86400 }, now)).toMatchObject({ ageDays: 23, basis: 'standard_or_unknown' });
  expect(windThresholds({ ageDays: 3, ageRecordedAtUtc: now - 2 * 86400 }, now)).toMatchObject({ ageDays: 5, basis: 'young_recorded_age' });
});
test.each([
  { startedOn: '2026-11-12' }, { startedOn: '2026-02-30' }, { startedOn: 'bad-date' },
  { ageDays: -1, ageRecordedAtUtc: now }, { ageDays: 2, ageRecordedAtUtc: now + 1 },
  { startedOn: '2026-11-10', ageKnown: false },
])('invalid or explicitly unknown age stays unknown: %j', context => {
  expect(windThresholds(context, now)).toMatchObject({ ageDays: null, basis: 'standard_or_unknown' });
});
test('age is evaluated in the plant timezone', () => {
  expect(windThresholds({ startedOn: '2026-10-28', timeZone: 'Africa/Johannesburg' }, Date.parse('2026-11-11T22:30:00Z') / 1000).ageDays).toBe(15);
  expect(windThresholds({ startedOn: '2026-10-28', timeZone: 'invalid' }, Date.parse('2026-11-11T22:30:00Z') / 1000).ageDays).toBe(14);
});
test.each(['unknown', 'vegetative', 'flowering'] as const)('height and older age never raise the default safety screen for %s', growthStage => {
  const plant = makePlantSummary({ growthStage, height: 250, startedOn: '2026-01-01' });
  expect(windThresholds(windPlantContext(plant), now)).toMatchObject({ sustainedMs: 40 / 3.6, gustMs: 60 / 3.6 });
});
describe.each(['seedling', 'unknown', 'vegetative'] as const)('shared wind screen for %s', growthStage => {
  describe.each(['current', 'forecast24h'] as const)('phase %s', phase => {
  test.each([[10, 20], [29.999, 44.999], [30, 0], [0, 45], [39.999, 59.999], [40, 60]])('sustained %s / gust %s km/h agrees in both engines', (speed, gust) => {
    const plant = makePlantSummary({ growthStage, startedOn: '2026-11-08' });
    const setup = plantSetup(plant);
    const threshold = growthStage === 'vegetative' ? [40, 60] : [30, 45];
    const expected = speed >= threshold[0] || gust >= threshold[1];
    const samples = [sample('wind_speed_ms', speed / 3.6), sample('wind_gust_ms', gust / 3.6)].map(s => ({ ...s,
      location_revision: setup.locationRevision, retrieved_at_utc: now, available_at_utc: now, valid_start_utc: phase === 'current' ? now : now + 3600, valid_end_utc: phase === 'current' ? now : now + 3600,
      time_support: 'point' as const, kind: phase === 'current' ? 'current_point' as const : 'forecast' as const }));
    const outdoor = evaluateOutdoorCare({ plantId: plant.id, plant, logs: [], samples, nowUtc: now });
    expect(outdoor.recommendations.some(r => r.category === 'wind')).toBe(expected);
    const evaluation = evaluateCare({ setup, evaluationUtc: now, profile: null, policyVersion: 'test', nextEvaluationUtc: now + 900,
      warningWindows: [{ phase, startUtc: phase === 'current' ? now - 3600 : now, endUtc: phase === 'current' ? now : now + 3600, completeVariables: [], samples }] });
    expect(evaluation.warnings.find(w => w.id === 'W03')?.state === 'triggered').toBe(expected);
    evaluation.weatherPreparationEnabled = true;
    if (expected) {
      expect(weatherCards(plant.id, evaluation, now)[0].summary).toContain(`${threshold[0]} km/h`);
      expect(outdoor.recommendations.find(r => r.category === 'wind')?.evidence.windScreen).toMatchObject({ sustainedMs: threshold[0] / 3.6 });
    }
  });
  });
});
