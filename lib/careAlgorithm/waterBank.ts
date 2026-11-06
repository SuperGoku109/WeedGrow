import { finite, type Decision, type Scenario } from './types';

function nonnegative(...values: number[]) {
  if (!values.every(value => finite(value) && value >= 0)) throw new Error('invalid_bank_input');
}
/** Physical parameters are evidence-backed arguments, never inferred from a pot label. */
export function capacityAndAction(accessibleVolumeL: number, thetaUpper: number, thetaLower: number, allowableDepletion: number) {
  nonnegative(accessibleVolumeL, thetaUpper, thetaLower, allowableDepletion);
  if (accessibleVolumeL <= 0 || thetaUpper > 1 || thetaLower >= thetaUpper || allowableDepletion > 1) throw new Error('invalid_capacity_parameters');
  const capacityL = accessibleVolumeL * (thetaUpper - thetaLower);
  return { capacityL, actionReserveL: capacityL * (1 - allowableDepletion) };
}
export function bankStep(reserveL: number, capacityL: number, waterL: number, potentialLossL: number, order: Scenario['order'] = 'inputs_first') {
  nonnegative(reserveL, capacityL, waterL, potentialLossL);
  if (capacityL <= 0 || reserveL > capacityL || !['inputs_first', 'loss_first'].includes(order)) throw new Error('invalid_bank_state');
  // Compute within the bounded bank; subtracting overflow from a huge input loses the small reserve.
  const beforeLoss = order === 'inputs_first' ? Math.min(capacityL, reserveL + waterL) : reserveL;
  const extractedL = Math.min(beforeLoss, potentialLossL);
  const afterLoss = beforeLoss - extractedL;
  const actualExcessL = Math.max(0, (order === 'inputs_first' ? reserveL : afterLoss) + waterL - capacityL);
  const nextReserveL = order === 'inputs_first' ? afterLoss : Math.min(capacityL, afterLoss + waterL);
  if (!finite(actualExcessL)) throw new Error('bank_numeric_overflow');
  return { reserveL: nextReserveL, extractedL, excessL: actualExcessL,
    unmetPotentialLossL: potentialLossL - extractedL };
}
export interface BankState { scenario: Scenario; reserveL: readonly [number, number]; atUtc: number; rootZoneKey: string }
export function validateState(state: BankState) {
  if (!state) throw new Error('invalid_bank_state');
  validateScenario(state.scenario);
  if (!finite(state.atUtc) || typeof state.rootZoneKey !== 'string' || !state.rootZoneKey.trim()
    || !Array.isArray(state.reserveL) || state.reserveL.length !== 2 || !state.reserveL.every(finite)
    || state.reserveL[0] < 0 || state.reserveL[0] > state.reserveL[1] || state.reserveL[1] > state.scenario.capacityL) throw new Error('invalid_bank_state');
}
export function validateScenario(s: Scenario) {
  if (!s || !Array.isArray(s.initialReserveL) || s.initialReserveL.length !== 2
    || !Array.isArray(s.unknownRefillL) || s.unknownRefillL.length !== 2) throw new Error('invalid_scenario');
  nonnegative(s.capacityL, s.actionReserveL, s.effectiveLossM2, s.catchmentM2, s.rainDelivery, s.retainedFraction,
    ...s.initialReserveL, ...s.unknownRefillL);
  if (!s.id || s.capacityL <= 0 || s.actionReserveL > s.capacityL || s.rainDelivery > 1 || s.retainedFraction > 1
    || s.initialReserveL[0] > s.initialReserveL[1] || s.initialReserveL[1] > s.capacityL
    || s.unknownRefillL[0] > s.unknownRefillL[1] || !['inputs_first', 'loss_first'].includes(s.order)) throw new Error('invalid_scenario');
}
export function initialize(scenario: Scenario, atUtc: number, rootZoneKey: string, anchored = false): BankState {
  validateScenario(scenario);
  if (!finite(atUtc) || typeof rootZoneKey !== 'string' || !rootZoneKey.trim() || typeof anchored !== 'boolean') throw new Error('invalid_anchor');
  return { scenario, reserveL: anchored ? [...scenario.initialReserveL] : [0, scenario.capacityL], atUtc, rootZoneKey };
}
export function advance(state: BankState, endUtc: number, et0Mm: number, rainMm: number, receivesRain: boolean): BankState {
  validateState(state);
  if (typeof receivesRain !== 'boolean') throw new Error('invalid_rain_reception');
  if (!finite(endUtc) || endUtc <= state.atUtc) throw new Error('invalid_interval');
  nonnegative(et0Mm, rainMm);
  const s = state.scenario;
  const water = receivesRain ? rainMm * s.catchmentM2 * s.rainDelivery : 0;
  return { ...state, atUtc: endUtc, reserveL: state.reserveL.map(r => bankStep(r, s.capacityL, water, et0Mm * s.effectiveLossM2, s.order).reserveL) as [number, number] };
}
export function refill(state: BankState, appliedL: number | null, retention: readonly [number, number] = [0, 1]): BankState {
  validateState(state);
  if (!Array.isArray(retention) || retention.length !== 2) throw new Error('invalid_retention');
  const s = state.scenario;
  if (appliedL !== null) nonnegative(appliedL);
  nonnegative(...retention);
  if (retention[0] > retention[1] || retention[1] > 1) throw new Error('invalid_retention');
  const amounts = appliedL === null ? s.unknownRefillL : retention.map(r => r * appliedL);
  return { ...state, reserveL: [Math.min(s.capacityL, state.reserveL[0] + amounts[0]), Math.min(s.capacityL, state.reserveL[1] + amounts[1])] };
}
export function decide(states: readonly BankState[]): Decision {
  if (!states.length) return 'uncertain';
  try { states.forEach(validateState); } catch { return 'uncertain'; }
  // Tolerance is arithmetic only, never a biological safety margin.
  if (states.every(s => s.reserveL[1] <= s.scenario.actionReserveL + 1e-10)) return 'water';
  if (states.every(s => s.reserveL[0] > s.scenario.actionReserveL + 1e-10)) return 'not_due';
  return 'uncertain';
}
export function transition(state: BankState, next: Scenario, rootZoneKey: string, effectiveAt: number, compatible: boolean): BankState {
  validateState(state);
  validateScenario(next);
  if (typeof compatible !== 'boolean' || typeof rootZoneKey !== 'string' || !rootZoneKey.trim()) throw new Error('invalid_transition');
  if (effectiveAt !== state.atUtc) throw new Error('transition_requires_boundary_replay');
  const carry = compatible === true && rootZoneKey === state.rootZoneKey && next.capacityL === state.scenario.capacityL;
  return { scenario: next, rootZoneKey, atUtc: effectiveAt, reserveL: carry ? [...state.reserveL] : [0, next.capacityL] };
}
