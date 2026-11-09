import { finite } from './types';

/** Provider condition code, not a severe-weather alert, hail forecast or injury prediction. */
export interface StormCondition {
  provider?: 'Open-Meteo';
  hazard: 'thunderstorm'; code: number; phase: 'current' | 'forecast24h'; validUtc: number;
  availableUtc: number; sourceRevision: string; locationRevision: number;
}
const THUNDERSTORM_CODES = [200, 201, 202, 210, 211, 212, 221, 230, 231, 232];
export function validStormCondition(value: unknown): value is StormCondition {
  if (!value || typeof value !== 'object') return false;
  const c = value as StormCondition;
  return c.hazard === 'thunderstorm' && (c.provider === 'Open-Meteo' ? [95, 96, 97, 99].includes(c.code) : THUNDERSTORM_CODES.includes(c.code)) && ['current', 'forecast24h'].includes(c.phase)
    && finite(c.validUtc) && finite(c.availableUtc) && typeof c.sourceRevision === 'string' && !!c.sourceRevision.trim()
    && Number.isInteger(c.locationRevision) && c.locationRevision >= 0;
}
/** WMO thunderstorm codes; this reports thunderstorm context, never a confirmed hail injury. */
export function meteoStormConditions(raw: import('@/lib/weather/openMeteo').OpenMeteoPayload,
  scope: { sourceRevision: string; locationRevision: number; availableUtc: number }, nowUtc: number): StormCondition[] {
  if (scope.availableUtc > nowUtc || nowUtc - scope.availableUtc >= 3600) return [];
  const rows = [
    ...(typeof raw.current?.time === 'number' && typeof raw.current.weather_code === 'number' ? [{ time: raw.current.time, code: raw.current.weather_code, phase: 'current' as const }] : []),
    ...raw.hourly.time.flatMap((time, i) => typeof raw.hourly.weather_code?.[i] === 'number' ? [{ time, code: raw.hourly.weather_code[i]!, phase: 'forecast24h' as const }] : []),
  ];
  return rows.filter(row => [95, 96, 97, 99].includes(row.code) && (row.phase === 'current' ? row.time <= nowUtc && nowUtc - row.time < 900 : row.time > nowUtc && row.time <= nowUtc + 86400))
    .map(row => ({ ...scope, provider: 'Open-Meteo' as const, hazard: 'thunderstorm' as const, code: row.code, validUtc: row.time, phase: row.phase }));
}
/** Uses numeric provider IDs only. Translated descriptions and raw alert prose cannot identify hail. */
export function openWeatherStormConditions(raw: unknown, scope: { sourceRevision: string; locationRevision: number; availableUtc: number }, nowUtc: number,
  maxCurrentAgeSeconds: number, maxForecastLeadSeconds: number): StormCondition[] {
  if (!raw || typeof raw !== 'object' || !finite(nowUtc) || !finite(scope.availableUtc) || scope.availableUtc > nowUtc
    || !finite(maxCurrentAgeSeconds) || maxCurrentAgeSeconds <= 0 || !finite(maxForecastLeadSeconds) || maxForecastLeadSeconds <= 0) return [];
  const payload = raw as { current?: unknown; hourly?: unknown };
  const rows: { row: unknown; phase: StormCondition['phase'] }[] = [{ row: payload.current, phase: 'current' }];
  if (Array.isArray(payload.hourly) && payload.hourly.length <= 96) rows.push(...payload.hourly.map(row => ({ row, phase: 'forecast24h' as const })));
  const result = new Map<string, StormCondition>();
  for (const { row, phase } of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { dt?: unknown; weather?: unknown };
    if (!finite(r.dt) || !Array.isArray(r.weather) || r.weather.length > 16) continue;
    if (phase === 'current' ? r.dt > nowUtc || nowUtc - r.dt >= maxCurrentAgeSeconds : r.dt <= nowUtc || r.dt > nowUtc + maxForecastLeadSeconds) continue;
    for (const weather of r.weather) {
      if (!weather || typeof weather !== 'object') continue;
      const code = (weather as { id?: unknown }).id;
      if (typeof code !== 'number' || !THUNDERSTORM_CODES.includes(code)) continue;
      const condition: StormCondition = { ...scope, hazard: 'thunderstorm', code, validUtc: r.dt, phase };
      if (validStormCondition(condition)) result.set(`${phase}:${r.dt}:${code}`, condition);
    }
  }
  return [...result.values()].sort((a, b) => a.validUtc - b.validUtc || a.code - b.code);
}
