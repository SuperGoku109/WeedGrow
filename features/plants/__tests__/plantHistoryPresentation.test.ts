import type { Plant } from '@/firestoreModels';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { historyDetails, historyEvent, historyRows } from '../plantHistoryPresentation';
import { plantThemes } from '../components/plantDetailTheme';
import { plantEditHistory } from '@/lib/plants/plantEditHistory';
const timestamp = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) }) as never;
const stamp = timestamp('2026-11-13T23:30:00Z');
const entry = (values: Partial<JournalEntry> = {}): JournalEntry => ({ id: 'one', type: 'note', updatedBy: 'u', timestamp: stamp, ...values });
const plant = { locationTimeZone: 'Africa/Johannesburg', createdAt: timestamp('2026-10-01T10:00:00Z') } as unknown as Plant;

it('uses specific icons and semantic colours for care, movement, phases and lifecycle events', () => {
  const t = plantThemes.grove;
  expect(historyEvent(entry({ type: 'watering' }), t)).toMatchObject({ title: 'Watering logged', icon: 'water-outline', color: t.water });
  expect(historyEvent(entry({ category: 'pests' }), t)).toMatchObject({ icon: 'ladybug', color: t.warm });
  expect(historyEvent(entry({ type: 'photo' }), t).icon).toBe('camera-outline');
  expect(historyEvent(entry({ historyEvent: 'status', toStatus: 'dead' }), t)).toMatchObject({ title: 'Plant marked as dead', icon: 'leaf-off', color: t.danger });
  expect(historyEvent(entry({ type: 'stage_change', fromStage: 'seedling', toStage: 'vegetative' }), t).title).toBe('Growth phase changed');
  expect(historyEvent(entry({ type: 'stage_change', fromStage: 'vegetative', toStage: 'vegetative' }), t).title).toBe('Growth phase reviewed');
});
it('preserves zero-valued readings, scheduled watering and late flowering details', () => {
  expect(historyDetails(entry({ type: 'watering', waterMl: 0, recordingSource: 'schedule', wateringRepeatChange: { enabled: false } }))).toContain('0 ml');
  expect(historyDetails(entry({ type: 'watering', recordingSource: 'schedule' }))).toBe('Automatically recorded');
  expect(historyDetails(entry({ type: 'stage_change', fromStage: 'flowering', toStage: 'flowering', toPhase: 'late_flowering', description: 'flowering → flowering' }))).toBe('Flowering → Late flowering');
  expect(historyDetails(entry({ type: 'harvest', harvest: { date: '2026-11-13', recordId: 'h', weightGrams: 45, notes: 'Finished' } }))).toBe('45 g harvested\nFinished');
});
it('uses recorded local days and honest date-only times, adding creation only after all pages load', () => {
  const logs = [entry({ id: 'photo', type: 'photo', photoUri: 'photo.jpg' }), entry({ id: 'phase', calendarDay: '2026-11-12', occurrencePrecision: 'date' })];
  const partial = historyRows(logs, plant, false);
  expect(partial.map(row => row.day)).toEqual(['2026-11-14', '2026-11-12']);
  expect(partial[0].time).toBe('01:30');
  expect(partial[1].time).toBe('Time not recorded');
  expect(historyRows(logs, plant, true).at(-1)?.log.id).toBe('__created');
  expect(historyRows([entry({ id: 'setup-created', description: 'Plant added to garden.' })], plant, true)).toHaveLength(1);
});
it('records meaningful edits without inventing changes from null defaults or logging photo URLs', () => {
  const before = { name: 'Fern', potSize: '10 L', potMaterial: undefined, imageUri: 'old-private-url' } as Plant;
  expect(plantEditHistory(before, { name: 'Fern', potSize: '20 L', potMaterial: null, imageUri: 'new-private-url' })).toBe('Pot size: 10 L → 20 L\nCover photo changed.');
});
