import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOwnedPlants } from './useGardenData';
import { snoozeCare } from '@/services/careSnooze';
export function useCareSnoozes(uid?: string) {
  const garden = useOwnedPlants(); const [migrationError, setMigrationError] = React.useState('');
  const [revision, retryMigration] = React.useReducer(value => value + 1, 0);
  const ownerMatches = !!uid && uid === garden.ownerId;
  const snoozes = React.useMemo(() => {
    const next: Record<string, number> = {};
    if (ownerMatches) garden.plants.forEach(plant => { for (const [kind, until] of Object.entries(plant.careSnoozes || {})) if (typeof until === 'number' && Number.isFinite(until) && until > Date.now()) next[`${plant.id}:${kind}`] = until; });
    return next;
  }, [garden.plants, ownerMatches]);
  const ready = ownerMatches && !garden.loading && !garden.error;
  const migrationPlants = React.useRef(garden.plants); migrationPlants.current = garden.plants;
  React.useEffect(() => {
    if (!ready || !uid) return;
    let active = true; setMigrationError('');
    void AsyncStorage.getItem(`weedgrow.snooze.v1.${uid}`).then(async raw => {
      if (!raw || !active) return;
      const legacy = JSON.parse(raw);
      for (const [task, until] of Object.entries(legacy)) if (active && typeof until === 'number' && until > Date.now() && migrationPlants.current.some(plant => task.startsWith(plant.id + ':'))) await snoozeCare(uid, task, until, true);
      if (active) await AsyncStorage.removeItem(`weedgrow.snooze.v1.${uid}`);
    }).catch(() => { if (active) setMigrationError('Some older snoozes could not be synced. Refresh to retry.'); });
    return () => { active = false; };
  }, [uid, ready, revision]);
  const refreshGarden = garden.refresh;
  const refresh = React.useCallback(() => { refreshGarden(); retryMigration(); }, [refreshGarden]);
  return { snoozes, error: ownerMatches ? garden.error || migrationError : '', loading: !!uid && (!ownerMatches || garden.loading), refresh };
}
