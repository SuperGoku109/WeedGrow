import { plantDay } from '@/lib/dates/plantDay';
import { evaluationValidAt } from '@/lib/careAlgorithm/evaluationValidity';
import { useSession } from '@/services/session';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { usePlantActivity } from '@/features/care/usePlantActivity';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useLocalCareRevision } from '@/hooks/useLocalCareRevision';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Plant } from '@/firestoreModels';
import logger from '@/lib/logger';
import {
  evaluateWateringInsights,
  type PlantSummary,
  type WateringInsight,
} from '@/lib/suggestions/wateringSuggestions';

interface WateringSuggestionState {
  stale: boolean;
  refresh(): void;
  loading: boolean;
  error: string | null;
  insights: WateringInsight[];
}

export function useWateringSuggestions(plants: (Plant & { id: string })[], enabled = true): WateringSuggestionState {
  const { user } = useSession(); const uid = user?.uid;
  const localCareRevision = useLocalCareRevision();
  const clock = useMinuteClock(); const [revision, retry] = useReducer(value => value + 1, 0);
  const inputKey = useMemo(() => JSON.stringify(plants.filter(plant => plant.status === 'active' && !plant.deleting).map(adviceInput)), [plants]);
  const inputs = useMemo(() => JSON.parse(inputKey) as PlantSummary[], [inputKey]);
  const ids = useMemo(() => inputs.map(plant => plant.id), [inputs]);
  const activity = usePlantActivity(enabled ? ids : [], ['watering'], plants);
  const { error: activityError, refresh: refreshActivity } = activity;
  const refresh = useCallback(() => { if (activityError) refreshActivity(); retry(); }, [activityError, refreshActivity]);
  const activityKey = JSON.stringify(ids.map(id => activity.logs[`${id}:watering`]?.map(log => [log.id, log.mutationId, log.calendarDay, log.timestamp?.toMillis?.()])));
  const daysKey = JSON.stringify(inputs.map(plant => plantDay(clock, plant.locationTimeZone)));
  const requestKey = `${uid}:${inputKey}:${activityKey}:${daysKey}:${revision}:${enabled}:${localCareRevision}`;
  const [result, setResult] = useState<{ key: string; insights: WateringInsight[]; loading: boolean; error: string | null }>({ key: '', insights: [], loading: false, error: null });
  useEffect(() => {
    if (!enabled || !uid || !inputs.length || activity.loading) return;
    const controller = new AbortController();
    setResult({ key: requestKey, insights: [], loading: true, error: null });
    // Coalesce the initial listener results and changes from one care action.
    const timer = setTimeout(() => {
      void evaluateWateringInsights(inputs, { execution: 'local' }, controller.signal).then(insights => {
        if (!controller.signal.aborted) setResult({ key: requestKey, insights, loading: false, error: null });
      }).catch(error => {
        if (!controller.signal.aborted) { logger.error('Unable to evaluate watering suggestions', error); setResult({ key: requestKey, insights: [], loading: false, error: 'Unable to evaluate watering suggestions' }); }
      });
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, uid, inputs, requestKey, activity.loading]);
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
  const stale = enabled && ids.length > 0 && !loading
    && (!insights.length || insights.some(insight => !evaluationValidAt(insight.careEvaluation, freshnessUtc)));
  return { stale, refresh, loading, error, insights };
}


