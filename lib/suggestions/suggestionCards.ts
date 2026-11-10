import { evaluateWateringInsights, type PlantSummary, type WateringInsight } from './wateringSuggestions';
import type { SuggestionCard } from './types';
import { evaluationValidAt, waterDecisionAt } from '@/lib/careAlgorithm/evaluationValidity';
import { ENGINE_VERSION } from '@/lib/careAlgorithm/types';
import { weatherCards } from '@/lib/careAlgorithm/weatherCards';
import { waterExplanation } from '@/lib/careAlgorithm/waterExplanation';
import { careDiagnosticEntries } from '@/lib/careAlgorithm/careDiagnostics';
type SuggestionEvalOptions = Partial<{ lookbackDays: number; rainfallThresholdMm: number; execution: 'local' | 'backend' }>;
export interface PlantSuggestionResult { plantId: string; plantName: string; insight: WateringInsight; cards: SuggestionCard[] }
/** Production route accepts only current versioned care decisions. Legacy caches cannot revive heuristics. */
export function buildSuggestionCardsFromInsight(insight: WateringInsight, now = new Date()): SuggestionCard[] {
  const evaluation = insight.careEvaluation;
  if (evaluation?.outdoor && evaluationValidAt(evaluation, now.getTime() / 1000)) {
    return evaluation.outdoor.recommendations.filter(r => r.status === 'active' && r.expiresAt > now.getTime() / 1000).map(r => ({
      id: `${insight.plantId}:${r.type}:${r.category}`, kind: r.type === 'watering' ? 'watering' as const : r.category === 'powderyMildew' ? 'powderyMildew' as const : r.type === 'health' ? 'health' as const : 'weather' as const,
      active: true, severity: r.priority === 'HIGH' ? 'warn' as const : r.priority === 'MEDIUM' ? 'watch' as const : 'info' as const, title: r.title, summary: r.description,
      reasons: [], confidence: r.dataQuality === 'GOOD' ? 'medium' as const : 'low' as const,
      metrics: { observationDriven: true, checkStatus: evaluation.outdoor!.checkStatus, nextCheckUtc: evaluation.outdoor!.nextCheckUtc, lastWateringUtc: evaluation.outdoor!.lastWateringUtc, lastWateringTimeKnown: evaluation.outdoor!.lastWateringTimeKnown, lastObservationUtc: evaluation.outdoor!.latestObservation?.at ?? null, lastMoistureState: evaluation.outdoor!.latestObservation?.state ?? null, timeZone: evaluation.outdoor!.timeZone, action: r.action, category: r.category, reasonCodes: r.reasonCodes.join(','), evaluatedAtUtc: r.generatedAt, expiresAtUtc: r.expiresAt }, algorithmVersion: ENGINE_VERSION,
    }));
  }

  if (evaluation?.outdoor) return [];
  const local = evaluation?.execution === 'local-experimental';
  const liveWeather = evaluation?.localInputs?.weatherMode === 'open-meteo';
  const automatic = evaluation?.localInputs?.profileMode === 'automatic';
  const expired = !evaluationValidAt(evaluation, now.getTime() / 1000);
  const needsWater = waterDecisionAt(evaluation, now.getTime() / 1000);
  const decision = needsWater === null ? 'uncertain' : needsWater ? 'water' : 'not_due';
  const explanation = evaluation ? waterExplanation(evaluation.water) : '';
  const localExplanation = (automatic ? explanation : explanation.replaceAll('Recorded watering', 'Recorded or simulated watering'))
    .replaceAll('Weather demand', liveWeather ? 'Modelled ET0 demand' : 'Assumed ET0 demand');
  const diagnostic = expired && evaluation && !local ? { ...insight.careDiagnostic, source: 'local_fallback' as const, status: 'server_evaluation_expired', checkedAtUtc: now.getTime() / 1000,
    backendRevisionPresent: insight.careDiagnostic?.backendRevisionPresent ?? true, snapshotEvaluatedUtc: evaluation.evaluationUtc, snapshotExpiresUtc: evaluation.nextEvaluationUtc ?? undefined } : insight.careDiagnostic;
  return [...weatherCards(insight.plantId, evaluation, now.getTime() / 1000), { id: `${insight.plantId}:watering`, kind: 'watering', active: true,
    severity: needsWater === true ? 'warn' : 'info',
    title: automatic ? needsWater === null ? 'Check whether watering is needed' : needsWater ? 'Estimated watering due' : 'Watering not due at this time' : local ? liveWeather ? needsWater === null ? 'Local model: inputs need attention' : needsWater ? 'Local model: watering due' : 'Local model: watering not due' : needsWater === null ? 'Local test: inputs need attention' : needsWater ? 'Local test: watering due' : 'Local test: watering not due'
      : needsWater === null ? 'Watering estimate unavailable' : needsWater ? 'Estimated watering due' : 'Watering not due at this time',
    summary: (automatic ? 'Estimated from your plant details, local weather and watering history. ' : local ? liveWeather ? 'Experimental estimate using Open-Meteo model weather and your test profile. ' : 'Experimental estimate using your test profile and assumed ET0/rain rates. ' : '')
      + (expired ? local ? 'This local result expired. Refresh to recalculate on this device.' : waterExplanation({ decision: 'uncertain', needsWater: null, reasonCodes: ['server_evaluation_expired'] }) : local ? localExplanation : explanation),
    diagnostics: careDiagnosticEntries(evaluation, diagnostic, now.getTime() / 1000),
    reasons: [], confidence: needsWater === null ? 'low' : local ? 'medium' : 'high', metrics: { needsWater, decision, experimental: local, automaticProfile: automatic, weatherDriven: liveWeather, evaluatedAtUtc: evaluation?.evaluationUtc ?? null, expiresAtUtc: evaluation?.nextEvaluationUtc ?? null },
    algorithmVersion: ENGINE_VERSION }];
}

export async function evaluateSuggestionCardsForPlants(
  plants: PlantSummary[],
  options?: SuggestionEvalOptions,
  signal?: AbortSignal,
): Promise<PlantSuggestionResult[]> {
  const insights = await evaluateWateringInsights(plants, options, signal);
  return insights.map((insight) => ({
    plantId: insight.plantId,
    plantName: insight.plantName,
    insight,
    cards: buildSuggestionCardsFromInsight(insight),
  }));
}

export async function evaluateSuggestionCardsForPlant(
  plant: PlantSummary,
  options?: SuggestionEvalOptions,
  signal?: AbortSignal,
): Promise<PlantSuggestionResult | null> {
  const [result] = await evaluateSuggestionCardsForPlants([plant], options, signal);
  return result ?? null;
}

export type { SuggestionCard, SuggestionConfidence, SuggestionKind, SuggestionSeverity } from './types';
