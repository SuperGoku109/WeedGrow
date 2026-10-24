import { useSession } from '@/services/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
export interface ProgressPic { id: string; imageUrl: string; timestamp?: { toMillis?: () => number; toDate?: () => Date }; caption?: string }
export function useProgressGallery(plantId?: string, enabled = true) {
  const { user } = useSession(); const uid = user?.uid;
  const loaded = useRef<{ key: string; at: number } | undefined>(undefined);
  const [pics, setPics] = useState<ProgressPic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<QueryDocumentSnapshot>();
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const key = `${uid || ''}:${plantId || ''}:${revision}`;
  useEffect(() => {
    let active = true; generation.current++; lock.current = false;
    if (!enabled) { setLoading(false); return; }
    if (loaded.current?.key === key && Date.now() - loaded.current.at < 60000) { setLoading(false); return; }
    setPics([]); setCursor(undefined); setLoading(!!plantId && !!uid); setError(''); setHasMore(false);
    if (!plantId || !uid) return;
    getDocs(query(collection(db, 'plants', plantId, 'progressPics'), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(20))).then(snapshot => {
      if (!active) return;
      loaded.current = { key, at: Date.now() };
      setPics(snapshot.docs.map(item => ({ ...item.data(), id: item.id, imageUrl: item.data().imageUrl || item.data().url } as ProgressPic)));
      setCursor(snapshot.docs.at(-1)); setHasMore(snapshot.size === 20);
    }).catch(() => { if (active) setError('Photos could not be loaded. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [plantId, uid, revision, enabled, key]);
  const loadMore = useCallback(async () => {
    if (!enabled || !uid || loaded.current?.key !== key || !plantId || !cursor || loading || !hasMore || lock.current) return;
    lock.current = true; const request = generation.current;
    setLoading(true); setError('');
    try {
      const snapshot = await getDocs(query(collection(db, 'plants', plantId, 'progressPics'), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), startAfter(cursor), limit(20)));
      if (request !== generation.current) return;
      setPics(previous => [...new Map([...previous, ...snapshot.docs.map(item => ({ ...item.data(), id: item.id, imageUrl: item.data().imageUrl || item.data().url } as ProgressPic))].map(pic => [pic.id, pic])).values()]);
      setCursor(snapshot.docs.at(-1)); setHasMore(snapshot.size === 20);
    } catch { if (request === generation.current) setError('Could not load more photos. Try again.'); }
    finally { if (request === generation.current) { lock.current = false; setLoading(false); } }
  }, [plantId, cursor, loading, hasMore, enabled, uid, key]);
  return { pics: loaded.current?.key === key ? pics : [], loading: loading || (enabled && !!uid && !!plantId && loaded.current?.key !== key && !error), error, hasMore, loadMore, refresh };
}
