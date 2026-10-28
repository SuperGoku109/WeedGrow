import { useSession } from '@/services/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProgressPage, fetchProgressPhoto, type PhotoCursor } from '@/services/progressGallery';
import type { ProgressPic } from '@/firestoreModels';
export type { ProgressPic } from '@/firestoreModels';
export function useProgressGallery(plantId?: string, enabled = true, focusId?: string) {
  const { user } = useSession(); const uid = user?.uid;
  const loaded = useRef<{ key: string; at: number } | undefined>(undefined);
  const [pics, setPics] = useState<ProgressPic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<PhotoCursor>();
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  // Cached-tab resumes skip the fetch effect, so always cancel pagination on unmount.
  useEffect(() => () => { generation.current++; }, []);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const key = `${uid || ''}:${plantId || ''}:${revision}:${focusId || ''}`;
  useEffect(() => {
    let active = true; generation.current++; lock.current = false;
    if (!enabled) { setLoading(false); return; }
    if (loaded.current?.key === key && Date.now() - loaded.current.at < 60000) { setLoading(false); return; }
    setPics([]); setCursor(undefined); setLoading(!!plantId && !!uid); setError(''); setHasMore(false);
    if (!plantId || !uid) return;
    Promise.all([fetchProgressPage(plantId), focusId ? fetchProgressPhoto(plantId, focusId) : Promise.resolve(null)]).then(([snapshot, focused]) => {
      if (!active) return;
      loaded.current = { key, at: Date.now() };
      setPics(focused ? [focused, ...snapshot.pics.filter(pic => pic.id !== focused.id)] : snapshot.pics);
      setCursor(snapshot.cursor); setHasMore(snapshot.hasMore);
    }).catch(() => { if (active) setError('Photos could not be loaded. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [plantId, uid, revision, enabled, key, focusId]);
  const loadMore = useCallback(async () => {
    if (!enabled || !uid || loaded.current?.key !== key || !plantId || !cursor || loading || !hasMore || lock.current) return;
    lock.current = true; const request = generation.current;
    setLoading(true); setError('');
    try {
      const snapshot = await fetchProgressPage(plantId, cursor);
      if (request !== generation.current) return;
      setPics(previous => [...new Map([...previous, ...snapshot.pics].map(pic => [pic.id, pic])).values()]);
      setCursor(snapshot.cursor); setHasMore(snapshot.hasMore);
    } catch { if (request === generation.current) setError('Could not load more photos. Try again.'); }
    finally { if (request === generation.current) { lock.current = false; setLoading(false); } }
  }, [plantId, cursor, loading, hasMore, enabled, uid, key]);
  return { pics: loaded.current?.key === key ? pics : [], loading: loading || (enabled && !!uid && !!plantId && loaded.current?.key !== key && !error), error, hasMore, loadMore, refresh };
}
