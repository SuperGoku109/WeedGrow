import { finite } from './types';

/** Output of a separately verified regional mapping. Raw provider alert prose is never input here. */
export interface SourceEvent {
  issuer: string; product: string; id: string; revision: number; sourceRevision: string;
  locationRevision: number; availableUtc: number; startUtc: number; endUtc: number;
  hazard: 'heat' | 'cold' | 'wind' | 'rain' | 'flood' | 'hail' | 'other';
  severity: string; cancelled: boolean;
}
export function activeSourceEvents(events: readonly SourceEvent[], now: number, locationRevision: number) {
  if (!finite(now) || !Number.isInteger(locationRevision)) throw new Error('invalid_source_scope');
  const groups = new Map<string, SourceEvent[]>(); const issues: string[] = [];
  for (const e of events) {
    if (e.locationRevision !== locationRevision || !finite(e.availableUtc) || e.availableUtc > now) continue;
    if (![e.issuer, e.product, e.id].every(v => typeof v === 'string' && v.trim())
      || !Number.isInteger(e.revision) || e.revision < 0) { issues.push('invalid_source_event'); continue; }
    const key = JSON.stringify([e.issuer, e.product, e.id]);
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  const active: SourceEvent[] = [];
  for (const rows of groups.values()) {
    const revision = Math.max(...rows.map(e => e.revision)); const latest = rows.filter(e => e.revision === revision);
    // Invalid newer corrections must block this identity, not revive an older hail/storm warning.
    if (latest.some(e => ![e.sourceRevision, e.severity].every(v => typeof v === 'string' && v.trim())
      || !finite(e.startUtc) || !finite(e.endUtc) || e.startUtc >= e.endUtc || typeof e.cancelled !== 'boolean'
      || !['heat', 'cold', 'wind', 'rain', 'flood', 'hail', 'other'].includes(e.hazard))) { issues.push('invalid_source_event'); continue; }
    const identities = new Set(latest.map(e => JSON.stringify([e.sourceRevision, e.startUtc, e.endUtc, e.cancelled, e.severity, e.hazard])));
    if (identities.size !== 1) { issues.push('source_event_revision_conflict'); continue; }
    const e = latest[0];
    if (!e.cancelled && e.startUtc <= now && e.endUtc > now) active.push({ ...e });
  }
  return { active: active.sort((a, b) => a.issuer.localeCompare(b.issuer) || a.id.localeCompare(b.id)), issues };
}
