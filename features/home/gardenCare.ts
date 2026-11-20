import type { Plant } from '@/firestoreModels';
import type { PlantSuggestionResult } from '@/lib/suggestions/suggestionCards';
import type { CareTask } from '@/lib/care/careTasks';
import { presentCareCard } from '@/features/plants/plantCare';
import { cardTipSignature, careTipKey, careTipRecords, findHandledCareTip, type CareTipTarget } from '@/lib/care/careTipHistory';
import { plantDay } from '@/lib/dates/plantDay';

export interface GardenCareGroup {
  key: string; title: string; priority: number;
  plants: { id: string; name: string; detail: string }[];
  tips?: CareTipTarget[];
}
/** Group shared advice while preserving each plant's own explanation. */
export function gardenCareGroups(results: Pick<PlantSuggestionResult, 'plantId' | 'cards'>[], tasks: CareTask[], plants: (Plant & { id: string })[], now: Date, includeHandled = false): GardenCareGroup[] {
  const active = new Map(plants.filter(p => p.status === 'active' && !p.deleting).map(p => [p.id, p]));
  const groups = new Map<string, GardenCareGroup>();
  const add = (key: string, title: string, priority: number, id: string, detail: string, tip?: CareTipTarget) => {
    const plant = active.get(id);
    if (!plant) return;
    const group = groups.get(key) || { key, title, priority, plants: [] };
    group.priority = Math.min(priority, group.priority);
    if (!group.plants.some(p => p.id === id)) {
      group.plants.push({ id, name: plant.name, detail });
      if (tip) (group.tips ??= []).push(tip);
    }
    groups.set(key, group);
  };
  for (const result of results) for (const raw of result.cards) {
    const plant = active.get(result.plantId);
    if (!plant) continue;
    const card = presentCareCard(raw, false, false, now);
    if (!card.active || card.severity === 'info' && !(card.kind === 'watering' && !card.metrics.observationDriven && card.metrics.needsWater !== false)) continue;
    const day = plantDay(now, plant.locationTimeZone);
    const signature = cardTipSignature(raw);
    const key = careTipKey(plant, day, signature);
    const handled = findHandledCareTip(plant, signature, now, card.kind);
    if (!includeHandled && handled) continue;
    const saved = handled ?? careTipRecords(plant).find(record => record.key === key);
    const tip = saved || { key, day, kind: card.kind, title: card.title, detail: card.summary.slice(0, 900), seenAt: now.getTime() };
    add(`${card.kind}:${card.title}`, card.title, { critical: 0, warn: 1, watch: 2, info: 3 }[card.severity], result.plantId, card.summary, { plantId: result.plantId, tip });
  }
  for (const task of tasks) {
    const plant = active.get(task.plantId);
    if (!plant || task.completedToday || task.skippedToday || task.due > now || (plant.careSnoozes?.[task.kind] || 0) > now.getTime()) continue;
    add(`routine:${task.kind}`, task.kind === 'watering' ? 'Watering reminder' : 'Feeding reminder', 3, task.plantId, task.kind === 'watering' ? 'Your watering routine is due. Check the soil before watering.' : 'Your feeding routine is due. Review this plant’s feeding needs.');
  }
  return [...groups.values()].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

export function pendingCareGroups(groups: GardenCareGroup[], plants: (Plant & { id: string })[]): GardenCareGroup[] {
  const handled = new Map(plants.map(plant => [plant.id, new Set(careTipRecords(plant).filter(tip => tip.handledAt !== undefined).map(tip => tip.key))]));
  return groups.flatMap(group => {
    if (!group.tips) return [group];
    const tips = group.tips.filter(({ plantId, tip }) => !handled.get(plantId)?.has(tip.key));
    const ids = new Set(tips.map(tip => tip.plantId));
    return tips.length ? [{ ...group, tips, plants: group.plants.filter(plant => ids.has(plant.id)) }] : [];
  });
}
