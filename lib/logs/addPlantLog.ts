import type { PlantLog } from '@/firestoreModels';
import { saveJournalEntry } from './journalRepository';
export async function addPlantLog(plantId: string, log: Omit<PlantLog, 'timestamp'>, date?: string) {
  return saveJournalEntry(plantId, log, date);
}
