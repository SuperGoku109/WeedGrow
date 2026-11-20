import type { CareTipRecord, Plant } from '@/firestoreModels';
import type { SuggestionCard } from '@/lib/suggestions/types';
import { addDays, isCalendarDay, plantDay } from '@/lib/dates/plantDay';

export type { CareTipRecord } from '@/firestoreModels';

export type CareTipTarget = { plantId: string; tip: CareTipRecord };
export const CARE_TIP_HISTORY_LIMIT = 60;

export function careTipKey(plant: Plant, day: string, signature: string) {
  return JSON.stringify([day, plant.locationRevision ?? 0, signature]);
}

export function remapCareTipPlant(record: CareTipRecord, oldId: string, newId: string): CareTipRecord {
  try {
    const [day, revision, encoded] = JSON.parse(record.key);
    const [id, ...context] = JSON.parse(encoded);
    if (typeof id === 'string' && id.startsWith(oldId + ':')) {
      const signature = JSON.stringify([newId + id.slice(oldId.length), ...context]);
      return { ...record, key: JSON.stringify([day, revision, signature]) };
    }
  } catch { /* Preserve older history with opaque signatures. */ }
  return record;
}

export function cardTipSignature(card: SuggestionCard) {
  return typeof card.reviewSignature === 'string'
    ? card.reviewSignature
    : JSON.stringify([card.id, card.severity, card.metrics.phase ?? null, card.metrics.action ?? null]);
}

export function careTipRecords(plant?: Plant | null): CareTipRecord[] {
  return Array.isArray(plant?.careTipHistory) ? plant.careTipHistory.filter(isCareTipRecord) : [];
}

export function isCareTipRecord(value: unknown): value is CareTipRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every(key => ['key', 'day', 'title', 'kind', 'detail', 'seenAt', 'handledAt'].includes(key))
    && typeof record.key === 'string' && record.key.length > 0 && record.key.length <= 700
    && typeof record.day === 'string' && isCalendarDay(record.day)
    && typeof record.title === 'string' && record.title.length <= 200
    && typeof record.kind === 'string' && ['weather', 'weatherContext', 'watering', 'health', 'rootRot', 'powderyMildew'].includes(record.kind)
    && typeof record.detail === 'string' && record.detail.length <= 900
    && typeof record.seenAt === 'number' && Number.isFinite(record.seenAt) && record.seenAt >= 0
    && (record.handledAt === undefined || typeof record.handledAt === 'number' && Number.isFinite(record.handledAt) && record.handledAt >= 0);
}

export function findHandledCareTip(plant: Plant | null | undefined, signature: string, now: Date, kind: SuggestionCard['kind']) {
  if (!plant) return undefined;
  const day = plantDay(now, plant.locationTimeZone);
  const todayKey = careTipKey(plant, day, signature);
  const previousKey = kind === 'weather' ? careTipKey(plant, addDays(day, -1), signature) : null;
  return careTipRecords(plant).find(record => record.handledAt !== undefined
    && (record.key === todayKey || (record.key === previousKey && now.getTime() - record.handledAt < 24 * 3600000)));
}

export function mergeCareTipHistory(existing: CareTipRecord[], tips: CareTipRecord[], handledAt?: number) {
  const records = new Map(existing.map(record => [record.key, record]));
  for (const tip of tips) {
    const current = records.get(tip.key);
    if (!current || (handledAt !== undefined && current.handledAt === undefined)) {
      records.set(tip.key, { ...(current || tip), ...(handledAt === undefined ? {} : { handledAt }) });
    }
  }
  return [...records.values()]
    .sort((a, b) => (b.handledAt ?? b.seenAt) - (a.handledAt ?? a.seenAt) || a.key.localeCompare(b.key))
    .slice(0, CARE_TIP_HISTORY_LIMIT);
}
