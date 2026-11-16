import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Plant } from '@/firestoreModels';
import { useLocalCareRevision } from '@/hooks/useLocalCareRevision';
import { plantDay } from '@/lib/dates/plantDay';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import type { PlantSummary } from '@/lib/suggestions/wateringSuggestions';
import { evaluateSuggestionCardsForPlants, type PlantSuggestionResult } from '@/lib/suggestions/suggestionCards';

interface CareResult {
  key: string;
  scope: string;
  results: PlantSuggestionResult[];
  loading: boolean;
  error: boolean;
}
const EMPTY_RESULTS: PlantSuggestionResult[] = [];

/** Own request cancellation and freshness separately from the overview's presentation. */
export function useGardenCareSuggestions(plants: (Plant & { id: string })[], now: Date) {
  const localRevision = useLocalCareRevision();
  const [revision, refresh] = useReducer(value => value + 1, 0);
  const inputKey = useMemo(() => JSON.stringify(plants.filter(plant => plant.status === 'active' && !plant.deleting).map(adviceInput)), [plants]);
  const inputs = useMemo(() => JSON.parse(inputKey) as PlantSummary[], [inputKey]);
  const daysKey = useMemo(() => JSON.stringify(inputs.map(plant => plantDay(now, plant.locationTimeZone))), [inputs, now]);
  const scope = JSON.stringify([inputKey, daysKey]);
  const requestKey = JSON.stringify([inputKey, daysKey, localRevision, revision]);
  const [state, setState] = useState<CareResult>({ key: '', scope: '', results: [], loading: false, error: false });

  useFocusEffect(useCallback(() => { refresh(); }, []));

  useEffect(() => {
    if (!inputs.length) return;
    const controller = new AbortController();
    setState(previous => ({ key: requestKey, scope, results: previous.scope === scope ? previous.results : [], loading: true, error: false }));
    void evaluateSuggestionCardsForPlants(inputs, { execution: 'local' }, controller.signal)
      .then(results => {
        if (!controller.signal.aborted) setState({ key: requestKey, scope, results, loading: false, error: results.length < inputs.length });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState(previous => ({ key: requestKey, scope, results: previous.scope === scope ? previous.results : [], loading: false, error: true }));
      });
    return () => controller.abort();
  }, [inputs, requestKey, scope]);

  useEffect(() => {
    if (state.key !== requestKey || state.loading || state.error) return;
    const expiries = state.results.flatMap(result => [
      result.insight?.careEvaluation?.nextEvaluationUtc,
      ...result.cards.map(card => card.metrics.expiresAtUtc),
    ]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value * 1000 > Date.now());
    const expiresAt = Math.min(...expiries);
    if (!Number.isFinite(expiresAt)) return;
    const timer = setTimeout(refresh, Math.max(1000, expiresAt * 1000 - Date.now() + 25));
    return () => clearTimeout(timer);
  }, [state, requestKey]);

  const current = state.key === requestKey;
  return {
    results: state.scope === scope && inputs.length ? state.results : EMPTY_RESULTS,
    loading: inputs.length > 0 && (!current || state.loading),
    error: inputs.length > 0 && current && state.error,
    refresh,
  };
}
