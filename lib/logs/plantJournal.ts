import type { PlantLog } from '@/firestoreModels';
import { isCalendarDay } from '@/lib/dates/plantDay';

export type JournalCategory = 'watering' | 'feeding' | 'pests' | 'training' | 'health' | 'notes';
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validateLogDate(value: string, today = localDateKey()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Use YYYY-MM-DD for the date.';
  if (!isCalendarDay(value)) return 'Enter a valid calendar date.';
  if (value > today) return 'Choose today or an earlier date for an activity log.';
  return null;
}
export function buildManualPlantLog(category: JournalCategory, description: string, updatedBy = ''): Omit<PlantLog, 'timestamp'> {
  const types: Record<JournalCategory, PlantLog['type']> = {
    watering: 'watering', feeding: 'fertilizing', pests: 'note', training: 'training', health: 'note', notes: 'note',
  };
  return { type: types[category], category, description: description.trim(), updatedBy };
}
export function journalCategory(log: PlantLog): JournalCategory | 'photo' | 'stage_change' | 'harvest' {
  return log.category ?? (log.type === 'fertilizing' ? 'feeding' : log.type === 'note' ? 'notes' : log.type);
}
