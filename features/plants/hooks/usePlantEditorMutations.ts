import { reportError } from '@/lib/diagnostics/reportError';
import { saveErrorMessage } from '@/lib/errors/saveFeedback';
import { useRef, useState } from 'react';
import { deletePlantAndSubcollections, updatePlant, type UpdatePlantFields } from '../api/plantService';
import type { useEditDraft } from '@/ui/useEditDraft';
import type { useDiscardGuard } from '@/ui/useDiscardGuard';

type Draft = Pick<ReturnType<typeof useEditDraft>, 'ready' | 'saved' | 'baseline' | 'clear'>;
type Guard = Pick<ReturnType<typeof useDiscardGuard>, 'finish' | 'setRemovalAllowed'>;
type Options = {
  plantId: string;
  draft: Draft;
  guard: Guard;
  blocked: boolean;
  buildUpdates(): UpdatePlantFields;
  onSaved(): void;
  onDeleted?: () => void;
};

/** Coordinates competing writes; the form owns fields and the service owns persistence. */
export function usePlantEditorMutations({ plantId, draft, guard, blocked, buildUpdates, onSaved, onDeleted }: Options) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (lock.current || blocked || !draft.ready || draft.saved) return;
    let updates: UpdatePlantFields;
    try { updates = buildUpdates(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Review the entered details.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      await updatePlant(plantId, updates, draft.baseline.current);
      await draft.clear().catch(() => {});
      guard.finish(onSaved);
    } catch (err) { reportError(err, 'save'); setError(saveErrorMessage(err, 'Changes could not be saved.')); }
    finally { lock.current = false; setBusy(false); }
  };
  const deletePlant = async () => {
    if (lock.current || blocked || !onDeleted || !draft.ready || draft.saved) return;
    lock.current = true; setBusy(true); guard.setRemovalAllowed(true);
    try {
      await deletePlantAndSubcollections(plantId);
      await draft.clear().catch(() => {});
      // Call directly: the deleted document's live stream may already have unmounted the form.
      onDeleted();
    } catch (err) { guard.setRemovalAllowed(false); throw err; }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, setError, save, deletePlant };
}
