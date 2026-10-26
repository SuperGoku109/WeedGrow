import type { Plant, PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import type { SuggestionCard } from '@/lib/suggestions/types';
import { localDateKey } from '@/lib/logs/plantJournal';

export const WEATHER_STALE_HOURS = 6;
export function weatherFreshness(weather?: WeatherCacheEntry, now = new Date()) {
  const fetched = weather?.fetchedAt?.toDate?.();
  const valid = fetched && Number.isFinite(fetched.getTime()) && fetched.getTime() <= now.getTime() + 60000;
  const age = valid ? Math.max(0, now.getTime() - fetched.getTime()) : Infinity;
  const historical = !!weather?.date && weather.date < localDateKey(now);
  const stale = !historical && age > WEATHER_STALE_HOURS * 3600000;
  const label = !valid ? 'Weather update time unavailable' : historical ? `Weather saved ${fetched.toLocaleString()}` : `Weather updated ${age < 60000 ? 'just now' : age < 3600000 ? `${Math.floor(age / 60000)} min ago` : `${Math.floor(age / 3600000)} hr ago`}${stale ? ' · Out of date' : ''}`;
  return { stale, label, fetched };
}
export function intervalDays(routine?: string): number | null {
  if (!routine) return null;
  const normalized = routine.trim().toLowerCase();
  if (['daily', 'every day'].includes(normalized)) return 1;
  if (['weekly', 'every week'].includes(normalized)) return 7;
  const match = normalized.match(/^every\s+(\d+)\s+days?$/);
  return match && Number(match[1]) > 0 ? Number(match[1]) : null;
}
export function careStatus({ routine, lastLog, recommendation, stale, now = new Date() }: { routine?: string; lastLog?: PlantLog; recommendation?: SuggestionCard; stale?: boolean; now?: Date }) {
  const last = lastLog?.timestamp?.toDate?.();
  if (last && localDateKey(last) === localDateKey(now)) return { label: `Recorded ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, recorded: true };
  if (!stale && recommendation?.confidence !== 'low' && typeof recommendation?.metrics.needsWater === 'boolean') return { label: recommendation.metrics.needsWater ? 'Due · check soil' : 'Not due', recorded: false };
  const interval = intervalDays(routine);
  if (interval && last) {
    const start = Date.UTC(last.getFullYear(), last.getMonth(), last.getDate());
    const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return { label: (end - start) / 86400000 >= interval ? 'Due by routine' : 'Not due by routine', recorded: false };
  }
  return { label: interval ? 'No recent record' : routine ? 'Check your routine' : 'No schedule', recorded: false };
}
export function relevantCareGaps(plant: Plant) {
  const fields: { label: string; section: string; reason: string }[] = [];
  if (!plant.location && plant.environment !== 'indoor') fields.push({ label: 'Location', section: 'Location and weather', reason: 'enables local weather advice' });
  if (plant.plantedIn === 'pot' && !plant.potSize) fields.push({ label: 'Pot size', section: 'Growing setup', reason: 'helps estimate how quickly the pot dries' });
  if (plant.environment !== 'indoor' && !plant.sunlightExposure) fields.push({ label: 'Sunlight', section: 'Growing setup', reason: 'helps estimate drying conditions' });
  return fields;
}
export function presentCareCard(card: SuggestionCard, wateredToday: boolean, stale: boolean): SuggestionCard {
  if (card.kind === 'watering' && wateredToday) return { ...card, severity: 'info', title: 'Watering recorded today', summary: 'Recheck soil before watering again.', reasons: [], confidence: 'high', metrics: { ...card.metrics, needsWater: false } };
  if (stale) return { ...card, confidence: 'low', severity: 'watch', title: card.kind === 'watering' ? 'Check soil moisture' : card.title, summary: 'Weather is out of date or its update time is unknown. Check current conditions before acting on this suggestion. ' + card.summary };
  if (card.kind === 'watering' && (card.confidence === 'low' || card.title.toLowerCase().includes('check whether'))) return { ...card, severity: 'watch', title: 'Check soil moisture', summary: 'Check the soil before deciding whether to water. ' + card.summary };
  return card;
}
