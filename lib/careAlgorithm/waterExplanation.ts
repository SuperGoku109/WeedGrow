import type { WaterResult } from './types';
import { careCodeMessage } from './careDiagnostics';

export function waterExplanation(water: WaterResult): string {
  const effects = water.evidence?.effects;
  if (water.needsWater === true) return 'Estimated watering is due: available water is at or below the watering threshold across all supported scenarios.'
    + (effects?.weatherDemand === true ? ' Weather demand is included in the loss estimate.' : '')
    + (effects?.loggedWatering === true ? ' Recorded watering is included, but does not establish enough retained water to stay above the threshold.' : '');
  if (water.needsWater === false) return 'Estimated watering is not due at the evaluation time: available water remains above the watering threshold across all supported scenarios.'
    + (effects?.directRain === true ? ' Rain reaching the root zone is included.' : '')
    + (effects?.loggedWatering === true ? ' Recorded watering is included.' : '')
    + ' New weather and watering records can change this estimate.';
  const backendIssue = water.reasonCodes.find(r => r.startsWith('server_'));
  if (backendIssue && careCodeMessage(backendIssue)) return careCodeMessage(backendIssue)!;
  const precise = water.reasonCodes.map(careCodeMessage).find(m => m !== null);
  if (precise) return precise;
  if (water.reasonCodes.some(r => /profile/.test(r))) return 'A supported hops watering profile is unavailable for this setup. Your logs and routine reminders remain available.';
  if (water.reasonCodes.some(r => /history|forcing|acquisition|backfill/.test(r))) return 'Recent weather or watering history is incomplete, so a current watering estimate is unavailable. Your logs and routine reminders remain available.';
  if (water.reasonCodes.includes('scenarios_span_watering_threshold')) return effects?.uncertainRainReception === true
    ? 'The estimate depends on how much rain reached the root zone, which is uncertain. A definite watering decision is unavailable.'
    : 'The supported water estimates fall on both sides of the watering threshold. A definite watering decision is unavailable.';
  return 'The available information does not yet support a definite watering estimate. Your logs and routine reminders remain available.';
}
