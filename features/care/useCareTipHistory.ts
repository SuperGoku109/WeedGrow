import React from 'react';
import type { Plant } from '@/firestoreModels';
import { careTipRecords, type CareTipTarget } from '@/lib/care/careTipHistory';
import { saveCareTips } from '@/services/careTipHistory';
import type { GardenCareGroup } from '@/features/home/gardenCare';

export function useCareTipHistory(uid: string | undefined, groups: GardenCareGroup[], plants: (Plant & { id: string })[], ready: boolean) {
  const [error, setError] = React.useState('');
  const [retry, refresh] = React.useReducer(value => value + 1, 0);
  const known = React.useMemo(() => new Map(plants.map(plant => [plant.id, new Set(careTipRecords(plant).map(tip => tip.key))])), [plants]);
  const missing = ready && uid ? groups.flatMap(group => group.tips ?? [])
    .filter(({ plantId, tip }) => !known.get(plantId)?.has(tip.key)) : [];
  const key = JSON.stringify(missing.map(({ plantId, tip }) => [plantId, tip.key]).sort());
  const targets = React.useRef(missing);
  targets.current = missing;

  React.useEffect(() => {
    if (!uid || (ready && key === '[]')) { setError(''); return; }
    if (key === '[]') return;
    let current = true;
    // A bounded write keeps one large garden from making an oversized request.
    const pending = targets.current;
    const capture = async () => {
      for (let offset = 0; current && offset < pending.length; offset += 50) {
        await saveCareTips(uid, pending.slice(offset, offset + 50));
      }
    };
    void capture().then(() => { if (current) setError(''); }).catch(() => {
      if (current) setError('Could not save recent tips to history.');
    });
    return () => { current = false; };
  }, [key, ready, retry, uid]);

  const complete = React.useCallback(async (tips: readonly CareTipTarget[]) => {
    if (!uid) throw new Error('Sign in to update care.');
    await saveCareTips(uid, tips, true);
  }, [uid]);

  return { error, refresh, complete };
}
