import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/services/session';
import { fetchPlantHistoryPage, type HistoryCursor } from '@/services/plantHistory';
import type { JournalEntry } from '@/lib/logs/journalRepository';

export function usePlantHistory(plantId: string) {
  const { user } = useSession();
  const uid = user?.uid;
  const [revision, setRevision] = useState(0);
  const scope = `${uid || ''}:${plantId}:${revision}`;
  const generation = useRef(0), locked = useRef(false);
  const [state, setState] = useState<{ scope: string; entries: JournalEntry[]; loading: boolean; error: string; cursor?: HistoryCursor; hasMore: boolean }>({ scope: '', entries: [], loading: true, error: '', hasMore: false });
  useEffect(() => {
    const request = ++generation.current;
    locked.current = false;
    setState({ scope, entries: [], loading: !!uid, error: uid ? '' : 'Sign in to view plant history.', hasMore: false });
    if (uid && plantId) {
      void fetchPlantHistoryPage(plantId).then(page => {
        if (request === generation.current) setState({ scope, ...page, loading: false, error: '' });
      }).catch(() => {
        if (request === generation.current) setState({ scope, entries: [], loading: false, error: 'History could not be loaded. Please retry.', hasMore: false });
      });
    }
    return () => { generation.current = request + 1; };
  }, [scope, uid, plantId]);
  const loadMore = useCallback(async () => {
    if (state.scope !== scope || locked.current || state.loading || !state.hasMore || !state.cursor || !uid) return;
    locked.current = true;
    const request = generation.current;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const page = await fetchPlantHistoryPage(plantId, state.cursor);
      if (request !== generation.current) return;
      if (page.hasMore && (!page.cursor || page.cursor.id === state.cursor.id)) throw new Error('History pagination did not advance.');
      setState(previous => ({ scope, ...page, entries: [...new Map([...previous.entries, ...page.entries].map(entry => [entry.id, entry])).values()], loading: false, error: '' }));
    } catch {
      if (request === generation.current) setState(previous => ({ ...previous, loading: false, error: 'Older events could not be loaded. Tap to retry.' }));
    } finally { if (request === generation.current) locked.current = false; }
  }, [scope, state, uid, plantId]);
  return { ...(state.scope === scope ? state : { entries: [], loading: true, error: '', hasMore: false }), loadMore, refresh: () => setRevision(value => value + 1) };
}
