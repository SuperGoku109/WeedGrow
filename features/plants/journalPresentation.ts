import type { PlantLog } from '@/firestoreModels';
import { isCalendarDay, plantDay } from '@/lib/dates/plantDay';
import { journalCategory } from '@/lib/logs/plantJournal';
const kinds = {
  watering: { label: 'Watering', icon: 'water-outline' }, feeding: { label: 'Feeding', icon: 'flask-outline' },
  pests: { label: 'Pests', icon: 'ladybug' }, training: { label: 'Training', icon: 'content-cut' },
  health: { label: 'Health', icon: 'heart-outline' }, notes: { label: 'Note', icon: 'note-text-outline' },
  photo: { label: 'Photo', icon: 'camera-outline' }, stage_change: { label: 'Stage change', icon: 'sprout' }, harvest: { label: 'Harvest', icon: 'basket-outline' },
} as const;
export function journalKind(log: PlantLog) { return kinds[journalCategory(log)] || kinds.notes; }
export function journalEntryDay(log: PlantLog, timeZone?: string | null) {
  return log.calendarDay && isCalendarDay(log.calendarDay) ? log.calendarDay : plantDay(log.timestamp.toDate(), log.timeZone || timeZone);
}
export function journalEntryTime(log: PlantLog, timeZone?: string | null) {
  const date = log.timestamp.toDate();
  try { return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(log.timeZone || timeZone ? { timeZone: log.timeZone || timeZone! } : {}) }); }
  catch { return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
}
