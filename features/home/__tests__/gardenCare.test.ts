import { gardenCareGroups } from '../gardenCare';
import type { Plant } from '@/firestoreModels';
import type { PlantSuggestionResult } from '@/lib/suggestions/suggestionCards';
import type { CareTask } from '@/lib/care/careTasks';
const now = new Date('2026-11-16T12:00:00Z');
const plants = [{ id: 'a', name: 'Fern', status: 'active' }, { id: 'b', name: 'Basil', status: 'active' }, { id: 'c', name: 'Past', status: 'archived' }] as (Plant & { id: string })[];
const result = (id: string, title = 'Wind alert', extra = {}): Pick<PlantSuggestionResult, 'plantId' | 'plantName' | 'cards'> => ({ plantId: id, plantName: id, cards: [{ id, kind: 'weather', active: true, title, summary: `Protect ${id}`, severity: 'warn', confidence: 'medium', reasons: [], metrics: {}, algorithmVersion: 'hops-8.4.0', ...extra }] });
const live = { expiresAtUtc: now.getTime() / 1000 + 3600 };
const task = (extra = {}): CareTask => ({ id: 'a:feeding', plantId: 'a', plantName: 'Fern', kind: 'feeding', due: new Date(now.getTime() - 1000), completedToday: false, skippedToday: false, time: '09:00', intervalDays: 7, ...extra });

it('groups shared advice, keeps per-plant explanations, and excludes plants outside the active scope', () => {
  const groups = gardenCareGroups(['a', 'b', 'c', 'outside'].map(id => result(id, 'Wind alert', { metrics: live })), [], plants, now);
  expect(groups).toHaveLength(1);
  expect(groups[0].plants).toEqual([{ id: 'a', name: 'Fern', detail: 'Protect a' }, { id: 'b', name: 'Basil', detail: 'Protect b' }]);
});
it('omits expired advice and informational watering statuses while preserving urgent checks', () => {
  const groups = gardenCareGroups([
    result('a', 'Expired', { metrics: { ...live, expiresAtUtc: 1, observationDriven: true } }),
    result('a', 'Watering not due', { kind: 'watering', severity: 'info', metrics: { needsWater: false } }),
    result('b', 'Check later', { kind: 'watering', severity: 'info', metrics: { ...live, observationDriven: true } }),
    result('a', 'Wind alert', { metrics: live }),
    result('b', 'Urgent check', { severity: 'critical', metrics: live }),
  ], [], plants, now);
  expect(groups.map(g => g.title)).toEqual(['Urgent check', 'Wind alert']);
});
it('includes due reminders and excludes completed, skipped, future, and snoozed care', () => {
  expect(gardenCareGroups([], [task()], plants, now)[0].title).toBe('Feeding reminder');
  expect(gardenCareGroups([], [task({ completedToday: true }), task({ skippedToday: true }), task({ due: new Date(now.getTime() + 1000) })], plants, now)).toEqual([]);
  expect(gardenCareGroups([], [task()], [{ ...plants[0], careSnoozes: { feeding: now.getTime() + 1000 } }], now)).toEqual([]);
});
