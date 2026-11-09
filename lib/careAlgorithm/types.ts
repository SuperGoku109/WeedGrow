/** Hops v8.4. All times are UTC epoch seconds; volumes are litres. */
export const ENGINE_VERSION = 'hops-8.4.0';
export type Decision = 'water' | 'not_due' | 'uncertain';
export type WarningId = 'W01' | 'W02' | 'W03' | 'W04' | 'W05' | 'W06' | 'W07' | 'W08' | 'W09' | 'W10' | 'W11' | 'W12' | 'W13' | 'W14';
export type WarningState = 'triggered' | 'not_triggered' | 'unknown' | 'not_applicable' | 'disabled' | 'context_only' | 'review_requested';
export type Phase = 'current' | 'historical24h' | 'forecast24h';
export type Variable = 'air_temperature_c' | 'air_rh_pct' | 'air_dewpoint_c' | 'wind_speed_ms' | 'wind_gust_ms' | 'shortwave_w_m2' | 'et0_mm' | 'liquid_rain_mm' | 'rain_rate_mm_h';
export interface WeatherSample {
  schema_version: '8.4'; provider: string; product: string; source_revision: string;
  model_selection: string; model_selection_basis: string; location_revision: number;
  retrieved_at_utc: number; available_at_utc: number; issued_at_utc: number | null;
  variable: Variable; value: number | null; unit: string;
  time_support: 'point' | 'interval_mean' | 'interval_maximum' | 'interval_sum' | 'rate';
  kind: 'occurred_estimate' | 'forecast' | 'current_point';
  valid_start_utc: number; valid_end_utc: number;
  quality: 'ok' | 'missing' | 'invalid'; reason_codes: string[];
  measurement_height_m?: number | null; grid_latitude?: number | null; grid_longitude?: number | null; grid_elevation_m?: number | null;
}
export interface Warning {
  id: WarningId; state: WarningState; phase: Phase; coverage: 'complete' | 'partial' | 'none';
  applicable: boolean | null; reasonCodes: string[]; evidence: Record<string, unknown>;
}
export interface Setup {
  status: string; deleting?: boolean; environment: string; plantedIn: string | null;
  stage: string | null; sun: string | null; medium: string | null;
  potVolumeL: number | null; soilRain: 'yes' | 'no' | 'partial' | 'unknown';
  canopyRain: 'yes' | 'no' | 'partial' | 'unknown'; locationRevision: number;
}
/** Coherent parameter sets, supplied by a versioned profile, never cross-multiplied. */
export interface Scenario {
  id: string; capacityL: number; actionReserveL: number; effectiveLossM2: number;
  catchmentM2: number; rainDelivery: number; retainedFraction: number;
  initialReserveL: readonly [number, number]; unknownRefillL: readonly [number, number];
  order: 'inputs_first' | 'loss_first';
}
export interface Profile {
  id: string; version: string; criterionId: string; validationEvidenceId: string;
  stateAnchorBasis: string; rootZoneKey: string; transitionPolicy: string;
  domain: { environment: string; plantedIn: string; stages: readonly (string | null)[];
    suns: readonly (string | null)[]; mediums: readonly (string | null)[];
    potVolumeL: readonly [number, number] | null; sourceKeys: readonly string[] };
  scenarios: readonly Scenario[];
}
export interface WaterResult {
  decision: Decision; needsWater: boolean | null; reasonCodes: string[];
  coverageIssue?: { variable: 'et0_mm' | 'liquid_rain_mm'; cause: 'gap' | 'missing_value' | 'invalid_value' | 'overlap' | 'unsupported_support'; fromUtc: number; toUtc: number };
  evidence?: {
    historyStartUtc: number; historyEndUtc: number;
    scenarios: { id: string; reserveL: readonly [number, number]; actionReserveL: number }[];
    effects: { weatherDemand: boolean; directRain: boolean; loggedWatering: boolean; uncertainRainReception: boolean };
  };
}
export interface Evaluation {
  /** Client experiments are never authenticated production releases. */
  execution?: 'local-experimental';
  localInputs?: { weatherMode?: 'manual' | 'open-meteo'; weatherRetrievedUtc?: number; anchorUtc: number; et0MmPerDay: number; rainMmPerDay: number; initialReserveL: number; extraWaterL: number; includeJournal: boolean; journalEntries: number };
  stormConditions?: import('./stormConditions').StormCondition[];
  waterRelease?: { approvalRecordId: string; profileId: string; profileVersion: string };
  weatherPreparationEnabled?: boolean;
  engineVersion: string; policyVersion: string; profileVersion: string | null;
  evaluationUtc: number; locationRevision: number; dataRevisionFingerprint: string;
  nextEvaluationUtc: number | null; water: WaterResult; warnings: Warning[];
}
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
