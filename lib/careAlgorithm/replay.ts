import { finite } from './types';
import { advance, validateState, type BankState } from './waterBank';
import { replayTimeline, type WaterTimelineInput } from './waterTimeline';
export type ReplayInput = WaterTimelineInput;
/** Current state replay, including bounded log timing and dated physical/demand transitions. */
export const replayWater = replayTimeline;

export interface ProjectionStep { startUtc: number; endUtc: number; et0Mm: number; rainMm: number }
export interface CrossingWindow { scenarioId: string; branch: number; initialReserveL: number; earliestUtc: number | null; latestUtc: number | null }
export interface WaterProjection {
  available: boolean; earliestUtc: number | null; latestUtc: number | null; censored: boolean;
  conditional: true; horizonUtc: number; crossings: CrossingWindow[]; reasonCodes: string[];
}
/** Conditional trajectory crossing windows. Hourly totals do not identify an exact within-hour crossing. */
export function projectWater(states: readonly BankState[], branches: readonly (readonly ProjectionStep[])[], horizonUtc: number, receivesRain: boolean): WaterProjection {
  const unavailable = (reason: string): WaterProjection => ({ available: false, earliestUtc: null, latestUtc: null, censored: true,
    conditional: true, horizonUtc, crossings: [], reasonCodes: [reason] });
  if (!states.length || !branches.length || !finite(horizonUtc) || typeof receivesRain !== 'boolean') return unavailable('forecast_input_unavailable');
  try { states.forEach(validateState); } catch { return unavailable('forecast_state_invalid'); }
  if (states.some(s => s.atUtc !== states[0].atUtc || horizonUtc <= s.atUtc)) return unavailable('forecast_window_invalid');
  const crossings: CrossingWindow[] = [];
  for (const state of states) for (const reserve of state.reserveL) for (let branch = 0; branch < branches.length; branch++) {
    const steps = branches[branch];
    if (!steps.length || steps[steps.length - 1].endUtc !== horizonUtc) return unavailable('forecast_horizon_incomplete');
    let s = { ...state, reserveL: [reserve, reserve] as const };
    let crossing: readonly [number, number] | null = reserve <= s.scenario.actionReserveL ? [s.atUtc, s.atUtc] : null;
    for (const step of steps) {
      if (step.startUtc !== s.atUtc || !finite(step.endUtc) || step.endUtc <= step.startUtc
        || !finite(step.et0Mm) || step.et0Mm < 0 || !finite(step.rainMm) || step.rainMm < 0) return unavailable('forecast_gap_or_invalid_forcing');
      const before = s;
      try { s = advance(s, step.endUtc, step.et0Mm, step.rainMm, receivesRain); } catch { return unavailable('forecast_step_invalid'); }
      // Loss-first may cross before later rain refills the bank; the endpoint alone would miss that crossing.
      const withinStep = before.scenario.order === 'loss_first' ? Math.max(0, before.reserveL[0] - step.et0Mm * before.scenario.effectiveLossM2) : s.reserveL[0];
      if (crossing === null && withinStep <= s.scenario.actionReserveL) crossing = [step.startUtc, step.endUtc];
    }
    crossings.push({ scenarioId: state.scenario.id, branch, initialReserveL: reserve,
      earliestUtc: crossing?.[0] ?? null, latestUtc: crossing?.[1] ?? null });
  }
  const crossed = crossings.filter(c => c.earliestUtc !== null);
  return { available: true, earliestUtc: crossed.length ? Math.min(...crossed.map(c => c.earliestUtc!)) : null,
    latestUtc: crossings.some(c => c.latestUtc === null) ? null : Math.max(...crossings.map(c => c.latestUtc!)),
    censored: crossings.some(c => c.latestUtc === null), conditional: true, horizonUtc, crossings,
    reasonCodes: ['conditional_forcing_branches', 'within_bin_crossing_bounds_not_interpolation'] };
}
