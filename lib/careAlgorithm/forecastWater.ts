import { integralPath, selectSamples, type SourceSelection } from './weather';
import { projectWater, type ProjectionStep, type WaterProjection } from './replay';
import { validateState, type BankState } from './waterBank';
import { profileIssues } from './profiles';
import { revisionFingerprint } from './revisions';
import { finite, type Profile, type Setup, type WeatherSample } from './types';

export interface ForecastWaterInput {
  states: readonly BankState[]; setup: Setup; profile: Profile; evaluationUtc: number; horizonUtc: number;
  weather: readonly WeatherSample[]; et0Source: SourceSelection; rainSource: SourceSelection;
}
export function forecastWater(input: ForecastWaterInput): WaterProjection {
  const { evaluationUtc: start, horizonUtc: end, setup, profile } = input;
  const unavailable = (reason: string): WaterProjection => ({ available: false, earliestUtc: null, latestUtc: null,
    censored: true, conditional: true, horizonUtc: end, crossings: [], reasonCodes: [reason] });
  if (!finite(start) || !finite(end) || start >= end || profileIssues(setup, profile).length) return unavailable('forecast_profile_or_window_invalid');
  if (setup.status !== 'active' || setup.deleting || setup.environment !== 'outdoor') return unavailable('forecast_plant_inapplicable');
  try {
    if (!input.states.length || !profile.scenarios.every(p => input.states.some(s => revisionFingerprint(s.scenario) === revisionFingerprint(p)))) return unavailable('forecast_state_scenario_missing');
    for (const state of input.states) {
      validateState(state);
      if (state.atUtc !== start || state.rootZoneKey !== profile.rootZoneKey || !profile.scenarios.some(s => revisionFingerprint(s) === revisionFingerprint(state.scenario))) return unavailable('forecast_state_mismatch');
    }
  } catch { return unavailable('forecast_state_invalid'); }
  const sources = [input.et0Source, ...(setup.soilRain === 'no' ? [] : [input.rainSource])];
  if (sources.some(s => !profile.domain.sourceKeys.includes(`${s.provider}/${s.product}/${s.modelSelection}`))) return unavailable('forecast_source_domain_unsupported');
  const et0 = selectSamples(input.weather, 'et0_mm', input.et0Source, setup.locationRevision, start);
  const rain = selectSamples(input.weather, 'liquid_rain_mm', input.rainSource, setup.locationRevision, start);
  const lossPath = integralPath(et0, start, end, 'forecast');
  const rainPath = setup.soilRain === 'no' ? { complete: true, rows: [] as WeatherSample[] } : integralPath(rain, start, end, 'forecast');
  if (!lossPath.complete || !rainPath.complete) return unavailable('forecast_coverage_missing');
  const boundaries = [...new Set([start, end, ...lossPath.rows.map(s => s.valid_end_utc), ...rainPath.rows.map(s => s.valid_end_utc)])].sort((a, b) => a - b);
  const wet: ProjectionStep[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    const a = boundaries[i - 1], b = boundaries[i];
    const loss = integralPath(et0, a, b, 'forecast');
    const water = setup.soilRain === 'no' ? { complete: true, total: 0 } : integralPath(rain, a, b, 'forecast');
    if (!loss.complete || !water.complete) return unavailable('forecast_subinterval_unavailable');
    wet.push({ startUtc: a, endUtc: b, et0Mm: loss.total!, rainMm: water.total! });
  }
  const dry = wet.map(step => ({ ...step, rainMm: 0 }));
  return projectWater(input.states, setup.soilRain === 'no' ? [dry] : [dry, wet], end, setup.soilRain !== 'no');
}
