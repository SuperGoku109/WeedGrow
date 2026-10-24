import React from 'react';
import { Text, View } from 'react-native';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { PlantLog } from '@/firestoreModels';
export default function PlantMovementHistory({ plantId }: { plantId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [entries, setEntries] = React.useState<PlantLog[]>([]); const [error, setError] = React.useState('');
  React.useEffect(() => onSnapshot(query(collection(db, 'plants', plantId, 'logs'), orderBy('timestamp', 'desc'), limit(100)), snapshot => { setEntries(snapshot.docs.map(item => item.data() as PlantLog).filter(item => !!item.movement)); setError(''); setLoading(false); }, () => { setError('Movement history could not be loaded.'); setLoading(false); }), [plantId]);
  return <View style={{ gap: 8 }}><Text style={{ color: '#edf0e3', fontWeight: '600' }}>Recent location changes</Text><Text style={{ color: '#bdcbb7', fontSize: 12 }}>Moves recorded from now on also appear in the full garden journal. Earlier weather stays unchanged.</Text>{!!error && <Text style={{ color: '#ffce9b' }}>{error}</Text>}{!error && !entries.length && <Text style={{ color: '#bdcbb7' }}>{loading ? 'Loading movement history…' : 'No moves in the latest 100 journal entries. Older moves remain in the full journal.'}</Text>}{entries.map((entry, index) => <Text key={index} style={{ color: '#bdcbb7' }}>{entry.timestamp?.toDate?.().toLocaleString()} · {entry.description}</Text>)}</View>;
}
