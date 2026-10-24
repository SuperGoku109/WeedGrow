import { useOwnedPlants } from '@/hooks/useGardenData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
export async function snoozeCare(uid: string, taskId: string, until: number, onlyIfMissing = false) {
  if (requireUserId() !== uid) throw new Error('Your account changed. Sign in again.');
  const [plantId, kind, extra] = taskId.split(':');
  if (!plantId || extra || !['watering', 'feeding'].includes(kind) || !Number.isFinite(until)) throw new Error('Choose a valid task and snooze time.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const plant = await tx.get(ref);
    if (!plant.exists() || !plant.data().owners?.includes(uid) || plant.data().deleting || plant.data().status !== 'active') throw new Error('This plant is not active in your account.');
    const careSnoozes = { ...(plant.data().careSnoozes || {}) };
    if (onlyIfMissing && careSnoozes[kind] != null) return;
    if (until > Date.now()) careSnoozes[kind] = until; else delete careSnoozes[kind];
    tx.update(ref, { careSnoozes });
  });
}
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
