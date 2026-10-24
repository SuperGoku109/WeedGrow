import { useSession } from '@/services/session';
import { useEffect, useState } from 'react';
import { fetchPlants, PlantItem } from '../api/fetchPlants';

export const usePlants = () => {
  const { user } = useSession();
  const [plants, setPlants] = useState<PlantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPlants([]); setError(null);
    const loadPlants = async () => {
      if (!user) { setPlants([]); setLoading(false); return; }
      try {
        const items = await fetchPlants();
        if (active) setPlants(items);
      } catch (e: any) {
        if (active) setError(e.message || 'Failed to load plants');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadPlants();
    return () => { active = false; };
  }, [user]);

  return { plants, loading, error };
};
