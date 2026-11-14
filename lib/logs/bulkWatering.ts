import type { Plant } from '@/firestoreModels';
import { mapConcurrent } from '@/lib/data/mapConcurrent';
import { saveJournalEntry } from './journalRepository';

/** Daily watering IDs prevent duplicates, including when retrying a partial save. */
export async function waterPlants(plants: readonly (Plant & { id: string })[]) {
  const active = [...new Map(plants.filter(plant => plant.status === 'active' && !plant.deleting).map(plant => [plant.id, plant])).values()];
  const results = await mapConcurrent(active, 3, async plant => {
    try {
      await saveJournalEntry(plant.id, { type: 'watering', category: 'watering', description: 'Watering recorded.', updatedBy: '' });
      return { id: plant.id, result: 'written' as const };
    } catch (error) {
      if (error instanceof Error && error.message === 'Watering already logged for this day.') return { id: plant.id, result: 'skipped' as const };
      return { id: plant.id, result: 'failed' as const };
    }
  });
  return {
    written: results.filter(item => item.result === 'written').length,
    skipped: results.filter(item => item.result === 'skipped').length,
    failed: results.filter(item => item.result === 'failed').length,
  };
}
