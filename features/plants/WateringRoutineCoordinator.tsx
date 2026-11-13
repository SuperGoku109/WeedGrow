import React from 'react';
import { AppState } from 'react-native';
import { useOwnedPlants } from '@/hooks/useGardenData';
import { recordDueWateringRoutine } from '@/services/wateringRoutine';
import { reportError } from '@/lib/diagnostics/reportError';

/** Reuse the shared plant subscription; no extra collection listener or polling reads. */
export default function WateringRoutineCoordinator() {
  const { plants, ownerId } = useOwnedPlants();
  const latest = React.useRef(plants); latest.current = plants;
  React.useEffect(() => {
    if (!ownerId) return;
    let active = true, running = false;
    const collect = async () => {
      if (running || !active || ['background', 'inactive'].includes(AppState.currentState)) return;
      running = true;
      try {
        for (const plant of latest.current) {
          if (!active) break;
          if (!plant.wateringRepeat || plant.wateringRepeat.nextAt > Date.now()) continue;
          for (let count = 0; active && count < 30; count++) {
            try { const next = await recordDueWateringRoutine(plant.id); if (next == null || next > Date.now()) break; }
            catch (error) { reportError(error, 'save'); break; }
          }
        }
      } finally { running = false; }
    };
    void collect();
    const timer = setInterval(() => void collect(), 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void collect(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [ownerId, plants.length]);
  return null;
}
