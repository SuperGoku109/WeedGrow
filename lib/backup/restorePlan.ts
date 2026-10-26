import { isRecord } from '@/lib/data/recordDecoders';
import type { GardenBackup } from './backupFormat';
export interface RestorePlan { operationId: string; paths: Record<string, string> }
export function validateRestorePlan(value: unknown, backup: GardenBackup): RestorePlan {
  if (!isRecord(value) || typeof value.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.operationId) || !isRecord(value.paths)) throw new Error('The saved restore plan is invalid. No garden data was changed.');
  const roots = backup.records.filter(record => record.path.split('/').length === 2).map(record => record.path);
  const paths: Record<string, string> = {}; const destinations = new Set<string>();
  if (Object.keys(value.paths).length !== roots.length) throw new Error('The restore plan does not match this backup.');
  for (const root of roots) {
    const destination = value.paths[root];
    if (typeof destination !== 'string' || destination === root || destination.split('/')[0] !== root.split('/')[0] || !/^(plants|groups|sensorProfiles)\/[A-Za-z0-9_-]{1,100}$/.test(destination) || destinations.has(destination)) throw new Error('The restore plan has invalid or overlapping destinations. No existing records were replaced.');
    paths[root] = destination; destinations.add(destination);
  }
  return { operationId: value.operationId, paths };
}
