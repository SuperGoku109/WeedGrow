import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
export interface ProgressPic { id: string; imageUrl: string; timestamp?: { toMillis?: () => number; toDate?: () => Date }; caption?: string }
export function useProgressGallery(plantId?: string) {
  const [pics, setPics] = useState<ProgressPic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setPics([]); setLoading(true); setError('');
    if (!plantId) { setLoading(false); return; }
    return onSnapshot(collection(db, 'plants', plantId, 'progressPics'), snapshot => {
      const arr = snapshot.docs.map(doc => { const data = doc.data(); return { ...data, id: doc.id, imageUrl: data.imageUrl || data.url } as ProgressPic; }).filter(pic => !!pic.imageUrl);
      arr.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setPics(arr); setLoading(false);
    }, () => { setError('Photos could not be loaded. Please check your connection.'); setLoading(false); });
  }, [plantId]);
  return { pics, loading, error };
}
