import { isRecord } from '@/lib/data/recordDecoders';
import { escapeCsv, type GardenBackup } from './backupFormat';
export const csvHeader = ['Plant', 'Date', 'Category', 'Observations', 'Water ml', 'Nutrients ml/L', 'pH', 'Height cm', 'Moisture %'].map(escapeCsv).join(',');
export function csvRow(name: unknown, data: Record<string, unknown>) {
  const timestamp = isRecord(data.timestamp) && typeof data.timestamp.$timestamp === 'number' ? new Date(data.timestamp.$timestamp).toISOString() : '';
  return [name, timestamp, data.category || data.type, data.description, data.waterMl, data.nutrientMlPerL, data.ph, data.heightCm, data.soilMoisture].map(escapeCsv).join(',');
}
export function journalCsv(backup: GardenBackup) {
  const names = new Map(backup.records.filter(record => /^plants\/[^/]+$/.test(record.path)).map(record => [record.path.split('/')[1], record.data.name]));
  return [csvHeader, ...backup.records.filter(record => record.path.includes('/logs/')).map(record => csvRow(names.get(record.path.split('/')[1]), record.data))].join('\r\n');
}
