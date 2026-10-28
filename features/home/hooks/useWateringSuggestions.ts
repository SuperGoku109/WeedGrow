import { plantDay } from '@/lib/dates/plantDay';
import { useSession } from '@/services/session';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { usePlantActivity } from '@/features/care/usePlantActivity';
import { useMinuteClock } from '@/hooks/useMinuteClock';
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
  const clock = useMinuteClock(); const [revision, retry] = useReducer(value => value + 1, 0);
  const inputKey = JSON.stringify(plants.filter(plant => plant.status === 'active' && plant.location).map(adviceInput));
  const ids = useMemo(() => (JSON.parse(inputKey) as PlantSummary[]).map(plant => plant.id), [inputKey]);
  const activity = usePlantActivity(enabled ? ids : [], ['watering'], plants);
  const { error: activityError, refresh: refreshActivity } = activity;
  const refresh = useCallback(() => { if (activityError) refreshActivity(); retry(); }, [activityError, refreshActivity]);
  const activityKey = JSON.stringify(ids.map(id => activity.logs[`${id}:watering`]?.map(log => [log.id, log.mutationId, log.calendarDay, log.timestamp?.toMillis?.()])));
  const daysKey = JSON.stringify((JSON.parse(inputKey) as PlantSummary[]).map(plant => plantDay(clock, plant.locationTimeZone)));
  const requestKey = `${uid}:${inputKey}:${activityKey}:${daysKey}:${revision}:${enabled}`;
  const [result, setResult] = useState<{ key: string; insights: WateringInsight[]; loading: boolean; error: string | null }>({ key: '', insights: [], loading: false, error: null });
  useEffect(() => {
    if (!enabled || !uid || !ids.length || activity.loading) return;
    const controller = new AbortController();
    setResult({ key: requestKey, insights: [], loading: true, error: null });
    // Coalesce the initial listener results and changes from one care action.
    const timer = setTimeout(() => {
      void evaluateWateringInsights(JSON.parse(inputKey), undefined, controller.signal).then(insights => {
        if (!controller.signal.aborted) setResult({ key: requestKey, insights, loading: false, error: null });
      }).catch(error => {
        if (!controller.signal.aborted) { logger.error('Unable to evaluate watering suggestions', error); setResult({ key: requestKey, insights: [], loading: false, error: 'Unable to evaluate watering suggestions' }); }
      });
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, uid, inputKey, requestKey, activity.loading, ids.length]);
  const insights = useMemo(() => enabled && result.key === requestKey ? result.insights : [], [enabled, result.key, result.insights, requestKey]);
  const loading = enabled && !!uid && ids.length > 0 && (activity.loading || result.key !== requestKey || result.loading);
  const error = activity.error || (result.key === requestKey ? result.error : null);

  const isFresh = useCallback((insight: WateringInsight) => typeof insight.weatherFetchedAtMs === 'number' && Number.isFinite(insight.weatherFetchedAtMs) && clock.getTime() - insight.weatherFetchedAtMs <= 6 * 3600000 && insight.weatherFetchedAtMs <= clock.getTime() + 60000, [clock]);
  const stale = enabled && ids.length > 0 && !loading && (!insights.length || insights.some(insight => !isFresh(insight)));
  const plantsNeedingWater = useMemo(() => insights.filter(insight => insight.needsWater && isFresh(insight)), [insights, isFresh]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!plantsNeedingWater.length) return [];

    const uniqueNames = Array.from(
      new Set(plantsNeedingWater.map((insight) => insight.plantName))
    );

    const description =
      plantsNeedingWater.length === 1
        ? plantsNeedingWater[0].reason
        : `${plantsNeedingWater.length} plants flagged. ${plantsNeedingWater[0].reason}`;

    return [
      {
        key: 'watering',
        icon: '💧',
        title: 'Plants to check for watering',
        description: 'Check soil moisture before acting on these estimates. ' + description,
        affected: uniqueNames,
      },
    ];
  }, [plantsNeedingWater]);

  return {
    stale, refresh,
    loading,
    error,
    suggestions,
    insights,
    plantsNeedingWater,
  };
}


