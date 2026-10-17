import React from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { PlantLog } from '@/firestoreModels';

export type JournalEntry = PlantLog & { id: string };
export function useRecentPlantActivity(id: string) {
  const [logs, setLogs] = React.useState<JournalEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    setLogs([]); setLoading(true); setError('');
    if (!id) { setLoading(false); return; }
    return onSnapshot(query(collection(db, 'plants', id, 'logs'), orderBy('timestamp', 'desc'), limit(200)), snapshot => {
      setLogs(snapshot.docs.map(doc => ({ ...doc.data({ serverTimestamps: 'estimate' }), id: doc.id } as JournalEntry)));
      setError(''); setLoading(false);
    }, () => { setError('Recent activity could not be loaded.'); setLoading(false); });
  }, [id]);
  return { logs, loading, error };
}
