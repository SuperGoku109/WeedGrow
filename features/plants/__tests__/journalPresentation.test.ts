import { journalEntryDay, journalEntryTime, journalKind } from '../journalPresentation';
import type { PlantLog } from '@/firestoreModels';
const log = { type: 'fertilizing', timestamp: { toDate: () => new Date('2026-10-26T00:30:00Z') }, updatedBy: '' } as PlantLog;
it('preserves a stored journal day and uses the entry’s original location for its displayed time', () => {
  const saved = { ...log, calendarDay: '2026-10-25', timeZone: 'America/Los_Angeles' };
  expect(journalEntryDay(saved, 'Asia/Tokyo')).toBe('2026-10-25'); expect(journalEntryTime(saved, 'Asia/Tokyo')).toBe('17:30');
  expect(journalKind(saved).label).toBe('Feeding');
});
it('falls back safely for legacy dates/zones instead of crashing the journal', () => {
  expect(journalEntryDay({ ...log, calendarDay: '2026-02-31' }, 'America/Los_Angeles')).toBe('2026-10-25');
  expect(() => journalEntryTime({ ...log, timeZone: 'Invalid/Zone' })).not.toThrow();
});
