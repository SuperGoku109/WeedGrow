import { decodeGardenSelection, plantsInGarden, resolveGardenSelection, summarizeGardenCollection, type HomeGarden } from '../gardenSelection';
import type { Plant } from '@/firestoreModels';

const home = { id: 'home', name: 'Home', plantIds: ['legacy', 'moved'], environment: 'outdoor' } as HomeGarden;
const tent = { id: 'tent', name: 'Tent', plantIds: [], environment: 'indoor' } as unknown as HomeGarden;
const plants = [
  { id: 'member', groupId: 'home' }, { id: 'legacy', groupId: null },
  { id: 'moved', groupId: 'tent' }, { id: 'unassigned', groupId: null },
] as (Plant & { id: string })[];

it('keeps membership scoped despite stale reverse indices, while retaining legacy members', () => {
  expect(plantsInGarden(plants, home).map(plant => plant.id)).toEqual(['member', 'legacy']);
  expect(plantsInGarden(plants, tent).map(plant => plant.id)).toEqual(['moved']);
  expect(plantsInGarden(plants, null)).toHaveLength(4);
});
it('restores valid selections and falls back after a garden is removed', () => {
  expect(resolveGardenSelection({ kind: 'garden', id: 'gone' }, [home, tent])).toEqual({ kind: 'garden', id: 'home' });
  expect(resolveGardenSelection({ kind: 'garden', id: 'tent' }, [home, tent])).toEqual({ kind: 'garden', id: 'tent' });
  expect(resolveGardenSelection({ kind: 'all' }, [home])).toEqual({ kind: 'all' });
  expect(resolveGardenSelection(null, [])).toEqual({ kind: 'all' });
});
it('rejects corrupt viewing preferences without hiding plants', () => {
  for (const raw of ['broken', '{}', '{"kind":"garden","id":"bad/path"}', '{"kind":"garden","id":42}']) expect(decodeGardenSelection(raw)).toBeNull();
  expect(decodeGardenSelection('{"kind":"garden","id":"home"}')).toEqual({ kind: 'garden', id: 'home' });
});

it('counts direct and legacy membership consistently, including stale and duplicate reverse indices', () => {
  const gardens = [{ ...home, plantIds: [...home.plantIds, 'legacy', 'absent', 'past'] }, { ...tent, plantIds: ['legacy'] }];
  const entries = [...plants.map(plant => ({ ...plant, status: 'active' as const })), { id: 'past', status: 'archived', groupId: null } as Plant & { id: string }];
  const summary = summarizeGardenCollection(entries, gardens);
  expect(summary.counts).toEqual({ home: 2, tent: 2 });
  for (const garden of gardens) expect(summary.counts[garden.id]).toBe(plantsInGarden(entries, garden).filter(plant => plant.status === 'active').length);
  expect(summary.unassigned).toBe(1);
  expect(summarizeGardenCollection(entries, []).unassigned).toBe(3);
  expect(summarizeGardenCollection([], gardens).counts).toEqual({ home: 0, tent: 0 });
});
