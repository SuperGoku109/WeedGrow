import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import type { PlantSummary } from '@/lib/suggestions/wateringSuggestions';

type RangeEntry = { logs: PlantLog[]; weather: WeatherCacheEntry | null };
export type RangeMap = Record<string, RangeEntry>;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toDateKey(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function makeTimestamp(date: Date) {
  const fixed = new Date(date);
  return {
    toDate: () => new Date(fixed),
  } as any;
}

export function makePlantSummary(overrides: Partial<PlantSummary> = {}): PlantSummary {
  const now = new Date(2026, 1, 10, 12, 0, 0, 0);
  return {
    id: 'plant-1',
    name: 'Test Plant',
    strain: 'Hybrid',
    owners: ['demoUser'],
    growthStage: 'vegetative',
    status: 'active',
    environment: 'outdoor',
    plantedIn: 'pot',
    location: { lat: 51.5, lng: -0.1 },
    createdAt: makeTimestamp(now),
    updatedAt: makeTimestamp(now),
    ...overrides,
  } as PlantSummary;
}

export function makeWeatherEntry(
  date: string,
  overrides: Partial<WeatherCacheEntry> = {},
): WeatherCacheEntry {
  const base: WeatherCacheEntry = {
    date,
    fetchedAt: makeTimestamp(new Date(2026, 1, 10, 8, 0, 0, 0)),
    forecasted: false,
    source: 'test',
    temperature: 24,
    humidity: 55,
    windSpeed: 8,
    rainfall: 0,
    uvIndex: 5,
    weatherSummary: 'clear',
    dewPoint: 12,
    cloudCoverage: 30,
    windGust: 12,
    pop: 0.1,
  };

  // Scenario inputs are human-facing km/h. Cached weather stores provider m/s.
  const value = { ...base, ...overrides };
  value.windSpeed /= 3.6;
  if (value.windGust != null) value.windGust /= 3.6;
  return value;
}

export function makeLog(date: Date, type: PlantLog['type'] = 'watering'): PlantLog {
  return {
    timestamp: makeTimestamp(date),
    type,
    description: 'test log',
    updatedBy: 'demoUser',
  } as PlantLog;
}

export function createRangeWindow(today: Date, lookbackDays = 6): RangeMap {
  const todayStart = startOfDay(today);
  const range: RangeMap = {};
  for (let offset = -lookbackDays; offset <= 1; offset++) {
    const key = toDateKey(addDays(todayStart, offset));
    range[key] = { logs: [], weather: null };
  }
  return range;
}

export function setRangeWeather(range: RangeMap, key: string, weather: WeatherCacheEntry | null) {
  if (!range[key]) range[key] = { logs: [], weather: null };
  range[key].weather = weather;
}

export function addRangeLog(range: RangeMap, key: string, log: PlantLog) {
  if (!range[key]) range[key] = { logs: [], weather: null };
  range[key].logs.push(log);
}
