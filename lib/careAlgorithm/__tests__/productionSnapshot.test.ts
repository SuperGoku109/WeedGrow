import { evaluateCare } from '../evaluate';
import { careInputKey, decodeCareSnapshot, type CareSnapshot } from '../snapshot';
import { weatherCards } from '../weatherCards';
import { makePlantSummary } from '@/lib/suggestions/__tests__/fixtures';
import { sample, setup, profile, scenario, source } from './helpers';
import { presentCareCard } from '@/features/plants/plantCare';

const plant = makePlantSummary({ locationRevision: 1, potSize: '10 L', careEvaluationRevision: 'server-r1' });
function snapshot(): CareSnapshot {
  const evaluation = evaluateCare({ setup, evaluationUtc: 7200, policyVersion: 'test-only', profile: null, nextEvaluationUtc: 8000,
    warningWindows: [{ phase: 'current', startUtc: 0, endUtc: 7200, completeVariables: [],
      samples: [sample('air_temperature_c', 40, { time_support: 'point', valid_start_utc: 3600 })] }] });
  evaluation.weatherPreparationEnabled = true;
  return { schemaVersion: 1, revision: 'server-r1', inputKey: careInputKey(plant), evaluation, configurationRevision: 10 };
}
test('protected snapshot round-trips and rejects changed setup/revision, expiry and legacy results', () => {
  const s = snapshot(); expect(decodeCareSnapshot(s, plant, 7300)).toEqual(s.evaluation);
  expect(decodeCareSnapshot(s, { ...plant, plantedIn: 'ground' }, 7300)).toBeNull();
  expect(decodeCareSnapshot(s, { ...plant, careEvaluationRevision: 'another' }, 7300)).toBeNull();
  expect(decodeCareSnapshot(s, plant, 8000)).toBeNull(); expect(decodeCareSnapshot({ needsWater: false }, plant, 7300)).toBeNull();
});
test('the weather release cannot smuggle an active watering result into the app', () => {
  const s = snapshot(); s.evaluation.profileVersion = 'client-approved';
  s.evaluation.water = { decision: 'water', needsWater: true, reasonCodes: [] };
  expect(decodeCareSnapshot(s, plant, 7300)).toBeNull();
});

test('the protected watering release accepts due/not-due with matching approval, profile and explicit expiry', () => {
  for (const reserve of [.1, 1.5]) {
    const p = { ...profile, scenarios: [{ ...scenario, initialReserveL: [reserve, reserve] as const }] };
    const evaluation = evaluateCare({ setup, evaluationUtc: 7200, profile: p, policyVersion: 'test-only', nextEvaluationUtc: 8000, warningWindows: [],
      approvedProfiles: { [`${p.id}@${p.version}`]: { profile: p, approvalRecordId: 'EMULATED-APPROVAL' } },
      replay: { anchorUtc: 7200, anchored: true, weather: [], events: [], et0Source: source, rainSource: source } });
    evaluation.waterRelease = { profileId: p.id, profileVersion: p.version, approvalRecordId: 'EMULATED-APPROVAL' };
    const s: CareSnapshot = { ...snapshot(), evaluation, waterConfigurationRevision: 42 };
    expect(decodeCareSnapshot(s, plant, 7300)?.water.needsWater).toBe(reserve < .8);
    expect(decodeCareSnapshot({ ...s, waterConfigurationRevision: undefined }, plant, 7300)).toBeNull();
    expect(decodeCareSnapshot({ ...s, evaluation: { ...evaluation, waterRelease: { ...evaluation.waterRelease, profileVersion: 'wrong' } } }, plant, 7300)).toBeNull();
  }
});
test('weather preparation is gated, expiry-bound, merged with container heat and independent of water uncertainty', () => {
  const s = snapshot(); const cards = weatherCards(plant.id, s.evaluation, 7300);
  expect(cards).toHaveLength(1); expect(cards[0].metrics.warningIds).toBe('W01,W08'); expect(cards[0].kind).toBe('weather');
  expect(s.evaluation.water.needsWater).toBeNull();
  expect(weatherCards(plant.id, { ...s.evaluation, weatherPreparationEnabled: false }, 7300)).toEqual([]);
  expect(weatherCards(plant.id, { ...s.evaluation, nextEvaluationUtc: null }, 7300)).toEqual([]);
  expect(weatherCards(plant.id, s.evaluation, 8000)).toEqual([]);
  expect(presentCareCard(cards[0], false, false, new Date(8000000)).active).toBe(false);
});
test('predictive-disease states cannot create cards through a malformed snapshot', () => {
  const s = snapshot(); s.evaluation.warnings = s.evaluation.warnings.map(w => ({ ...w, state: w.id === 'W10' ? 'triggered' : 'unknown' }));
  expect(weatherCards(plant.id, s.evaluation, 7300)).toEqual([]);
  expect(weatherCards(plant.id, { ...s.evaluation, warnings: null } as any, 7300)).toEqual([]);
});
test('snapshot dependencies exclude captions and snoozes but include genuine care facts and log revision', () => {
  expect(careInputKey({ ...plant, notes: 'new', careSnoozes: { watering: 123 } })).toBe(careInputKey(plant));
  expect(careInputKey({ ...plant, careRevision: 1 })).not.toBe(careInputKey(plant));
  expect(careInputKey({ ...plant, careMedium: 'soil' })).not.toBe(careInputKey(plant));
});
