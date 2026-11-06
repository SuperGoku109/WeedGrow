import type { SuggestionCard } from '@/lib/suggestions/types';
import { evaluationValidAt } from './evaluationValidity';
import { finite, type Evaluation, type Warning } from './types';
import { validStormCondition } from './stormConditions';

/** Factual preparation cards only. These never recommend water, diagnose disease or create health tasks. */
export function weatherCards(plantId: string, e: Evaluation | undefined, nowUtc: number): SuggestionCard[] {
  if (!evaluationValidAt(e, nowUtc) || e!.weatherPreparationEnabled !== true || !finite(e!.nextEvaluationUtc)
    || !Array.isArray(e!.warnings) || !e!.warnings.every(w => w && typeof w.id === 'string' && typeof w.state === 'string')) return [];
  const evaluation = e!;
  const result: SuggestionCard[] = [];
  const push = (key: string, flags: Warning[], title: string, summary: string, context = false) => {
    result.push({ id: `${plantId}:${key}`, kind: context ? 'weatherContext' : 'weather', active: true, severity: context ? 'info' : 'watch',
      confidence: 'medium', title, summary, reasons: [], algorithmVersion: evaluation.engineVersion,
      metrics: { warningIds: flags.map(f => f.id).join(','), phase: flags.every(f => f.phase === 'forecast24h') ? 'forecast24h' : 'current',
        expiresAtUtc: evaluation.nextEvaluationUtc, evaluatedAtUtc: evaluation.evaluationUtc } });
  };
  const flags = evaluation.warnings;
  if (flags.every(f => f.state === 'not_applicable')) return [];
  const storms = Array.isArray(evaluation.stormConditions) ? evaluation.stormConditions.filter(c => validStormCondition(c)
    && c.locationRevision === evaluation.locationRevision && c.availableUtc <= evaluation.evaluationUtc
    && (c.phase === 'forecast24h' ? c.validUtc > Math.max(evaluation.evaluationUtc, nowUtc) : c.validUtc <= evaluation.evaluationUtc)) : [];
  if (storms.length) {
    const hasCurrent = storms.some(c => c.phase === 'current'); const hasForecast = storms.some(c => c.phase === 'forecast24h');
    const phase = hasCurrent ? 'current' : 'forecast24h';
    result.push({ id: `${plantId}:thunderstorm`, kind: 'weather', active: true, severity: 'watch', confidence: 'medium',
      title: phase === 'current' ? 'Thunderstorm reported' : 'Thunderstorms forecast',
      summary: `${phase === 'current' ? 'The weather service reports thunderstorms for this location. Stay sheltered during lightning and follow local official warnings. Once conditions are safe, check supports, drainage and visible damage.'
        : 'The weather service forecasts thunderstorms for this location. Before conditions arrive, secure supports and loose containers when safe. Stay sheltered during lightning and follow local official warnings.'}${hasCurrent && hasForecast ? ' Thunderstorms are also forecast later in the forecast window.' : ''} Thunderstorms alone do not confirm hail, flooding or plant damage, and do not determine watering need.`,
      reasons: [], algorithmVersion: evaluation.engineVersion, metrics: { hazard: 'thunderstorm', phase, hasCurrent, hasForecast, conditionCount: storms.length,
        firstValidUtc: Math.min(...storms.map(c => c.validUtc)), expiresAtUtc: evaluation.nextEvaluationUtc, evaluatedAtUtc: evaluation.evaluationUtc } });
  }
  for (const id of ['W01', 'W02', 'W03', 'W04']) {
    const flag = flags.find(f => f.id === id && f.state === 'triggered'); if (!flag) continue;
    const future = flag.phase === 'forecast24h';
    const title = { W01: future ? 'Hot weather expected' : 'High air temperature', W02: future ? 'Cold weather expected' : 'Low air temperature',
      W03: future ? 'Prepare for forecast wind' : 'Wind preparation', W04: future ? 'Heavy rain expected' : 'Heavy rain reported' }[id]!;
    const summary = { W01: 'Air temperature crosses the 32°C preparation screen. Consider shade and ventilation where appropriate.',
      W02: 'Air temperature crosses the 5°C preparation screen. Consider suitable protection from cold conditions.',
      W03: 'Reported wind reaches at least 36 km/h, or gusts reach at least 54 km/h. Check supports and secure loose containers when safe.',
      W04: 'Reported rain rate or known amount crosses the rain preparation screen. Keep drainage routes clear.' }[id]!;
    const merged = id === 'W01' ? flags.filter(f => f.id === 'W08' && f.state === 'context_only') : [];
    push(id, [flag, ...merged], title, `${future ? 'Forecast conditions. ' : 'Recent/current conditions. '}${summary} These are weather screens, not a prediction of plant damage or water need.${merged.length ? ' The plant is in a container; this does not measure root temperature.' : ''}`);
  }
  // Ordinary canopy rain remains recorded as context, but does not warrant another standalone card.
  const wet = flags.filter(f => ['W09', 'W11'].includes(f.id) && f.state === 'context_only');
  if (wet.length) wet.push(...flags.filter(f => f.id === 'W12' && f.state === 'context_only'));
  if (wet.length) push('ambient', wet, wet.some(f => f.id === 'W11') ? 'Flowering-weather context' : 'Humid or rainy conditions',
    'Supported weather evidence indicates humid air or rain reaching the canopy. This is environmental context; it does not establish leaf wetness, infection or a need to change watering.', true);
  return result;
}
