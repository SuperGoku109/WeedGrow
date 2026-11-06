import { selectWaterHistory } from '../historySelection';
import { sample, profile, setup } from './helpers';
import { boundedOccurredIntegral } from '../weather';
import { waterExplanation } from '../waterExplanation';
import { replayWater } from '../replay';

const row = (value: number | null, revision = 'r1', available = 7200) => sample('et0_mm', value, { provider: 'Open-Meteo', product: 'archive', model_selection: 'era5', source_revision: revision, retrieved_at_utc: available, available_at_utc: available });
test('latest available correction wins per integral and missing corrections never revive old values', () => {
  const rows = [row(1), row(null, 'r2', 8000), row(0, 'r3', 9000)];
  expect(selectWaterHistory(rows, 'era5', 1, 7500).samples[0].value).toBe(1);
  expect(selectWaterHistory(rows, 'era5', 1, 8500).samples[0].quality).toBe('missing');
  expect(selectWaterHistory(rows, 'era5', 1, 9500).samples[0].value).toBe(0);
});
test('equal-authority conflicting history, wrong model/location and past forecast cannot become a water path', () => {
  expect(selectWaterHistory([row(1), row(2, 'r2')], 'era5', 1, 8000).reasonCodes).toContain('equal_authority_history_conflict');
  expect(selectWaterHistory([{ ...row(1), kind: 'forecast' }, { ...row(1), location_revision: 2 }, { ...row(1), model_selection: 'other' }], 'era5', 1, 8000).samples).toEqual([]);
});
test('partial completed totals use zero/full bounds; missing intervals cannot supply a bound', () => {
  expect(boundedOccurredIntegral([row(4)], 1800, 3600)).toMatchObject({ complete: true, lower: 0, upper: 4, partial: true });
  expect(boundedOccurredIntegral([row(4)], 0, 3600)).toMatchObject({ complete: true, lower: 4, upper: 4, partial: false });
  expect(boundedOccurredIntegral([row(4)], 0, 3601).complete).toBe(false);
});
test('watering explanations track the actual decision rather than the local unavailable fallback', () => {
  expect(waterExplanation({ decision: 'water', needsWater: true, reasonCodes: [] })).toContain('watering is due');
  expect(waterExplanation({ decision: 'not_due', needsWater: false, reasonCodes: [] })).toContain('not due at the evaluation time');
  expect(waterExplanation({ decision: 'uncertain', needsWater: null, reasonCodes: ['history_gap'] })).toContain('history is incomplete');
});

test('a conflicting rain path cannot erase complete demand for sheltered roots, but blocks an exposed plant', () => {
  const demand = row(1, 'r1', 3600);
  const rain = { ...demand, variable: 'liquid_rain_mm' as const, value: 0 };
  const selected = selectWaterHistory([demand, rain, { ...rain, value: 100, source_revision: 'conflict' }], 'era5', 1, 3600);
  const p = { ...profile, domain: { ...profile.domain, sourceKeys: ['Open-Meteo/archive/era5'] } };
  const input = { profile: p, anchorUtc: 0, evaluationUtc: 3600, anchored: true, weather: selected.samples,
    events: [], et0Source: selected.et0Source, rainSource: selected.rainSource };
  expect(replayWater({ ...input, setup: { ...setup, soilRain: 'no' } }).candidate).toBe('water');
  expect(replayWater({ ...input, setup }).candidate).toBe('uncertain');
});
