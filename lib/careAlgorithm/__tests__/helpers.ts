import type { Profile, Scenario, Setup, Variable, WeatherSample } from '../types';
import { UNITS } from '../weather';
export const setup: Setup = { status: 'active', environment: 'outdoor', plantedIn: 'pot', stage: 'vegetative', sun: 'full', medium: null,
  potVolumeL: 10, soilRain: 'yes', canopyRain: 'yes', locationRevision: 1 };
export const scenario: Scenario = { id: 'synthetic', capacityL: 2, actionReserveL: .8, effectiveLossM2: .2, catchmentM2: .08,
  rainDelivery: 1, retainedFraction: .8, initialReserveL: [1, 1], unknownRefillL: [.08, .32], order: 'inputs_first' };
export const profile: Profile = { id: 'synthetic-only', version: 'test', criterionId: 'test-only', validationEvidenceId: 'not-real-outcomes',
  stateAnchorBasis: 'synthetic', rootZoneKey: 'test-zone', transitionPolicy: 'test', domain: { environment: 'outdoor', plantedIn: 'pot',
    stages: ['vegetative'], suns: ['full'], mediums: [null], potVolumeL: [5, 20], sourceKeys: ['test/archive/test'] }, scenarios: [scenario] };
export const source = { provider: 'test', product: 'archive', modelSelection: 'test', sourceRevision: 'r1' };
export function sample(variable: Variable, value: number | null, extra: Partial<WeatherSample> = {}): WeatherSample {
  return { schema_version: '8.4', provider: 'test', product: 'archive', source_revision: 'r1', model_selection: 'test',
    model_selection_basis: 'test', location_revision: 1, retrieved_at_utc: 7200, available_at_utc: 7200, issued_at_utc: null,
    variable, value, unit: UNITS[variable], time_support: 'interval_sum', kind: 'occurred_estimate', valid_start_utc: 0,
    valid_end_utc: 3600, quality: value === null ? 'missing' : 'ok', reason_codes: [], ...extra };
}
