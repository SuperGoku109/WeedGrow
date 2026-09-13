import { buildManualPlantLog, journalCategory, localDateKey, validateLogDate } from '../plantJournal';
import type { PlantLog } from '@/firestoreModels';

describe('manual journal entries', () => {
  it('preserves pest and health categories while remaining compatible with note storage', () => {
    for (const category of ['pests', 'health'] as const) {
      const entry = buildManualPlantLog(category, '  checked leaves  ');
      expect(entry).toMatchObject({ type: 'note', category, description: 'checked leaves' });
      expect(journalCategory(entry as PlantLog)).toBe(category);
    }
  });
  it('uses the existing fertilizer type for feeding and reads legacy logs', () => {
    expect(buildManualPlantLog('feeding', '').type).toBe('fertilizing');
    expect(journalCategory({ type: 'fertilizing' } as PlantLog)).toBe('feeding');
    expect(journalCategory({ type: 'note' } as PlantLog)).toBe('notes');
  });
  it('rejects impossible dates and future activities', () => {
    expect(validateLogDate('2026-02-30', '2026-09-13')).toBeTruthy();
    expect(validateLogDate('2026-09-14', '2026-09-13')).toBeTruthy();
    expect(validateLogDate('13/09/2026', '2026-09-13')).toBeTruthy();
    expect(validateLogDate('2026-09-13', '2026-09-13')).toBeNull();
    expect(validateLogDate('2024-02-29', '2026-09-13')).toBeNull();
  });
  it('groups entries using local calendar fields rather than UTC conversion', () => {
    const localMidnight = new Date(2026, 8, 13, 0, 5);
    expect(localDateKey(localMidnight)).toBe('2026-09-13');
  });
});
