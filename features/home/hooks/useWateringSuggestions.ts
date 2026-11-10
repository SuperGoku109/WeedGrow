import { plantDay } from '@/lib/dates/plantDay';
import { evaluationValidAt, waterDecisionAt } from '@/lib/careAlgorithm/evaluationValidity';
import { useSession } from '@/services/session';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { usePlantActivity } from '@/features/care/usePlantActivity';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useLocalCareRevision } from '@/hooks/useLocalCareRevision';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { PlantWithId } from '@/features/groups/hooks/useGroupDetail';
import logger from '@/lib/logger';
import {
  evaluateWateringInsights,
  type PlantSummary,
  type WateringInsight,
} from '@/lib/suggestions/wateringSuggestions';
import type { Suggestion } from '@/ui/SuggestionCatalog';

interface WateringSuggestionState {
  stale: boolean;
  refresh(): void;
  loading: boolean;
  error: string | null;
  suggestions: Suggestion[];
  insights: WateringInsight[];
  plantsNeedingWater: WateringInsight[];
}

export function useWateringSuggestions(plants: PlantWithId[], enabled = true): WateringSuggestionState {
  const { user } = useSession(); const uid = user?.uid;
  const localCareRevision = useLocalCareRevision();
  const clock = useMinuteClock(); const [revision, retry] = useReducer(value => value + 1, 0);
  const inputKey = JSON.stringify(plants.filter(plant => plant.status === 'active' && !plant.deleting).map(adviceInput));
  const ids = useMemo(() => (JSON.parse(inputKey) as PlantSummary[]).map(plant => plant.id), [inputKey]);
  const activity = usePlantActivity(enabled ? ids : [], ['watering'], plants);
  const { error: activityError, refresh: refreshActivity } = activity;
  const refresh = useCallback(() => { if (activityError) refreshActivity(); retry(); }, [activityError, refreshActivity]);
  const activityKey = JSON.stringify(ids.map(id => activity.logs[`${id}:watering`]?.map(log => [log.id, log.mutationId, log.calendarDay, log.timestamp?.toMillis?.()])));
  const daysKey = JSON.stringify((JSON.parse(inputKey) as PlantSummary[]).map(plant => plantDay(clock, plant.locationTimeZone)));
  const requestKey = `${uid}:${inputKey}:${activityKey}:${daysKey}:${revision}:${enabled}:${localCareRevision}`;
  const [result, setResult] = useState<{ key: string; insights: WateringInsight[]; loading: boolean; error: string | null }>({ key: '', insights: [], loading: false, error: null });
  useEffect(() => {
    if (!enabled || !uid || !ids.length || activity.loading) return;
    const controller = new AbortController();
    setResult({ key: requestKey, insights: [], loading: true, error: null });
    // Coalesce the initial listener results and changes from one care action.
    const timer = setTimeout(() => {
      void evaluateWateringInsights(JSON.parse(inputKey), { execution: 'local' }, controller.signal).then(insights => {
        if (!controller.signal.aborted) setResult({ key: requestKey, insights, loading: false, error: null });
      }).catch(error => {
        if (!controller.signal.aborted) { logger.error('Unable to evaluate watering suggestions', error); setResult({ key: requestKey, insights: [], loading: false, error: 'Unable to evaluate watering suggestions' }); }
      });
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, uid, inputKey, requestKey, activity.loading, ids.length]);
  useEffect(() => {
    if (!enabled || result.loading || result.key !== requestKey || result.error) return;
    const due = Math.min(...result.insights.flatMap(i => i.careEvaluation?.outdoor && typeof i.careEvaluation.nextEvaluationUtc === 'number' ? [i.careEvaluation.nextEvaluationUtc] : []));
    if (!Number.isFinite(due)) return;
    const timer = setTimeout(retry, Math.max(1000, due * 1000 - Date.now() + 25));
    return () => clearTimeout(timer);
  }, [enabled, result, requestKey]);
  const insights = useMemo(() => enabled && result.key === requestKey ? result.insights : [], [enabled, result.key, result.insights, requestKey]);
  const loading = enabled && !!uid && ids.length > 0 && (activity.loading || result.key !== requestKey || result.loading);
  const error = activity.error || (result.key === requestKey ? result.error : null);
  // Weather acquisition can finish after the minute clock's last sample.
  const freshnessUtc = Date.now() / 1000;
  const isFresh = useCallback((insight: WateringInsight) => evaluationValidAt(insight.careEvaluation, freshnessUtc), [freshnessUtc]);
  const stale = enabled && ids.length > 0 && !loading && (!insights.length || insights.some(insight => !isFresh(insight)));
  const plantsNeedingWater = useMemo(() => insights.filter(insight => isFresh(insight) && (insight.careEvaluation?.outdoor ? ['CHECK_NOW', 'CHECK_SOON'].includes(insight.careEvaluation.outdoor.checkStatus) : waterDecisionAt(insight.careEvaluation, freshnessUtc) === true)), [insights, freshnessUtc, isFresh]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const conditions: Suggestion[] = insights.filter(isFresh).flatMap(insight => (insight.careEvaluation?.outdoor?.recommendations ?? [])
      .filter(r => r.type !== 'watering' && r.expiresAt > freshnessUtc).map(r => ({ recommendation: r, plantName: insight.plantName, plantId: insight.plantId })))
      .sort((a, b) => rank[a.recommendation.priority] - rank[b.recommendation.priority]).slice(0, 3)
      .map(({ recommendation: r, plantName, plantId }) => ({ key: `${plantId}:${r.category}`, icon: r.type === 'weather' ? '🌦️' : '🌿', title: r.title, description: r.description, affected: [plantName] }));
    if (!plantsNeedingWater.length) return conditions;

    const uniqueNames = Array.from(
      new Set(plantsNeedingWater.map((insight) => insight.plantName))
    );

    const description =
      plantsNeedingWater.length === 1
        ? plantsNeedingWater[0].reason
        : `${plantsNeedingWater.length} plants flagged. ${plantsNeedingWater[0].reason}`;

    return [...conditions,
      {
        key: 'watering',
        icon: '💧',
        title: 'Plants to check for watering',
        description: (plantsNeedingWater.every(insight => insight.careEvaluation?.localInputs?.profileMode === 'automatic') ? 'Based on soil observations, weather and care records. ' : 'Manual test overrides are included. ') + 'Check soil moisture before watering. ' + description,
        affected: uniqueNames,
      },
    ];
  }, [plantsNeedingWater, insights, isFresh, freshnessUtc]);

  return {
    stale, refresh,
    loading,
    error,
    suggestions,
    insights,
    plantsNeedingWater,
  };
}


