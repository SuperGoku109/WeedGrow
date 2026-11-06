import { finite, type Phase, type Setup, type Warning, type WarningId, type WarningState, type WeatherSample, type WaterResult } from './types';
import { warningEvidence } from './warningEvidence';

export interface WarningWindow {
  phase: Phase; startUtc: number; endUtc: number;
  /** A source/path policy must establish coverage; actual samples are checked as well. */
  completeVariables: readonly WeatherSample['variable'][]; samples: readonly WeatherSample[];
}
const knownStages = ['germination', 'seedling', 'vegetative', 'flowering', 'clone'];
export function flowerContext(stage: string | null, canopyRain: Setup['canopyRain'], rainPositive: boolean | null, rainComplete: boolean, humidPositive: boolean | null, humidityComplete: boolean): WarningState {
  if (!knownStages.includes(stage ?? '')) return 'unknown';
  if (stage !== 'flowering') return 'not_applicable';
  if (humidPositive === true || (canopyRain === 'yes' && rainPositive === true)) return 'context_only';
  const rainRuledOut = canopyRain === 'no' || (rainComplete && rainPositive === false);
  return rainRuledOut && humidityComplete && humidPositive === false ? 'not_triggered' : 'unknown';
}
function flag(id: WarningId, state: WarningState, phase: Phase = 'current', complete = false, evidence: Record<string, unknown> = {}, reasonCodes: string[] = []): Warning {
  return { id, state, phase, coverage: complete ? 'complete' : Object.keys(evidence).length ? 'partial' : 'none',
    applicable: state === 'not_applicable' ? false : state === 'unknown' ? null : true, evidence, reasonCodes };
}
export function evaluateWarnings(setup: Setup, windows: readonly WarningWindow[], water: WaterResult, problemTopic?: 'excess_root_water' | 'establishment' | 'root_wilt') {
  if (setup.status !== 'active' || setup.deleting) return Array.from({ length: 14 }, (_, i) => flag(`W${String(i + 1).padStart(2, '0')}` as WarningId, 'not_applicable', 'current', true, {}, ['inactive_plant']));
  if (setup.environment !== 'outdoor') windows = [];
  const current = windows.filter(w => ['current', 'forecast24h'].includes(w.phase) && finite(w.startUtc) && finite(w.endUtc)
    && w.endUtc >= w.startUtc && w.endUtc - w.startUtc <= 86400);
  const evidence = (w: WarningWindow, variable: WeatherSample['variable'], supports: readonly WeatherSample['time_support'][], intervals = false) => warningEvidence(w, variable, setup.locationRevision, supports, intervals);
  const positiveState = (positive: boolean, complete: boolean, context = false): WarningState => positive ? context ? 'context_only' : 'triggered' : complete ? 'not_triggered' : 'unknown';
  function screen(id: WarningId, tests: readonly [WeatherSample['variable'], (v: number) => boolean, readonly WeatherSample['time_support'][]][]) {
    const perPhase = current.map(w => {
      const paths = tests.map(([variable, test, supports]) => { const path = evidence(w, variable, supports); return { ...path, positive: path.rows.some(s => test(s.value!)) }; });
      return { phase: w.phase, positive: paths.some(p => p.positive), complete: paths.every(p => p.complete), reasons: paths.map(p => p.reason).filter(Boolean) };
    });
    const positive = perPhase.find(p => p.positive && p.phase === 'current') ?? perPhase.find(p => p.positive); const complete = perPhase.length > 0 && perPhase.every(p => p.complete);
    return flag(id, positiveState(!!positive, complete), positive?.phase, complete,
      { phases: perPhase, thresholdBasis: 'engineering_screen_not_hops_damage_threshold' }, positive ? ['supported_threshold_crossing'] : complete ? ['screen_not_crossed'] : ['weather_coverage_missing']);
  }
  const heat = screen('W01', [['air_temperature_c', v => v >= 32, ['point']]]);
  const cold = screen('W02', [['air_temperature_c', v => v <= 5, ['point']]]);
  const wind = screen('W03', [['wind_speed_ms', v => v >= 10, ['point']], ['wind_gust_ms', v => v >= 15, ['point', 'interval_maximum']]]);
  const rainPhases = current.map(w => {
    const rate = evidence(w, 'rain_rate_mm_h', ['rate']); const amount = evidence(w, 'liquid_rain_mm', ['interval_sum'], true);
    return { phase: w.phase, positive: rate.rows.some(s => s.value! >= 10) || amount.rows.reduce((sum, s) => sum + s.value!, 0) >= 25,
      complete: rate.complete && amount.complete, knownAmountMm: amount.rows.reduce((sum, s) => sum + s.value!, 0), reasons: [rate.reason, amount.reason].filter(Boolean) };
  });
  const rainComplete = rainPhases.length > 0 && rainPhases.every(p => p.complete);
  const rainPhase = rainPhases.find(p => p.positive && p.phase === 'current') ?? rainPhases.find(p => p.positive);
  const rain = flag('W04', positiveState(rainPhases.some(p => p.positive), rainComplete), rainPhase?.phase, rainComplete, { phases: rainPhases });
  const humidPerPhase = current.map(w => {
    const path = evidence(w, 'air_rh_pct', ['interval_mean'], true);
    return { phase: w.phase, positive: path.rows.some(s => s.value! >= 90), complete: path.complete, reason: path.reason };
  });
  const humidityPositive = humidPerPhase.some(p => p.positive);
  const humidityComplete = humidPerPhase.length > 0 && humidPerPhase.every(p => p.complete);
  const wetPerPhase = current.map(w => {
    const amount = evidence(w, 'liquid_rain_mm', ['interval_sum'], true); const rate = evidence(w, 'rain_rate_mm_h', ['rate']);
    return { phase: w.phase, positive: amount.rows.some(s => s.value! > 0) || rate.rows.some(s => s.value! > 0), complete: amount.complete };
  });
  const wetPositive = wetPerPhase.some(p => p.positive); const wetComplete = wetPerPhase.length > 0 && wetPerPhase.every(p => p.complete);
  const wetState = setup.canopyRain === 'no' ? 'not_applicable' : setup.canopyRain === 'yes' && wetPositive ? 'context_only'
    : wetComplete && !wetPositive ? 'not_triggered' : 'unknown';
  const humid = flag('W09', positiveState(humidityPositive, humidityComplete, true), humidPerPhase.find(p => p.positive)?.phase, humidityComplete,
    { phases: humidPerPhase, basis: 'interval_mean_representative_approximation_not_leaf_wetness' });
  return [heat, cold, wind, rain,
    flag('W05', 'unknown', 'current', false, {}, ['trusted_regional_source_mapping_unconfigured']),
    flag('W06', water.needsWater === true ? 'triggered' : water.needsWater === false ? 'not_triggered' : 'unknown', 'current', typeof water.needsWater === 'boolean', {}, water.reasonCodes),
    flag('W07', problemTopic === 'excess_root_water' ? 'review_requested' : 'not_triggered'),
    flag('W08', setup.plantedIn === 'ground' ? 'not_applicable' : setup.plantedIn !== 'pot' ? 'unknown' : heat.state === 'triggered' ? 'context_only' : heat.state, heat.phase, heat.coverage === 'complete', { mergedInto: 'W01' }),
    humid, flag('W10', 'disabled', 'current', false, {}, ['predictive_disease_not_validated']),
    flag('W11', flowerContext(setup.stage, setup.canopyRain, wetPositive, wetComplete, humidityPositive, humidityComplete), humidityPositive ? humid.phase : wetPerPhase.find(p => p.positive)?.phase,
      wetComplete && humidityComplete, { rainPositive: wetPositive, humidityPositive }),
    flag('W12', wetState, wetPerPhase.find(p => p.positive)?.phase, wetComplete, { canopyRain: setup.canopyRain, rainPositive: wetPositive }),
    flag('W13', !knownStages.includes(setup.stage ?? '') ? 'unknown' : !['germination', 'seedling', 'clone'].includes(setup.stage!) ? 'not_applicable' : problemTopic === 'establishment' ? 'review_requested' : 'not_triggered'),
    flag('W14', problemTopic === 'root_wilt' ? 'review_requested' : 'not_triggered')];
}
