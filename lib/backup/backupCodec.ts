import { Timestamp } from 'firebase/firestore';
import { isRecord } from '@/lib/data/recordDecoders';
export type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };
export function encodeBackupValue(value: unknown): JsonValue {
  if (value == null) return null;
  if (isRecord(value) && typeof value.toMillis === 'function') { const millis: unknown = value.toMillis(); if (typeof millis !== 'number' || !Number.isFinite(millis)) throw new Error('A saved timestamp is invalid.'); return { $timestamp: millis }; }
  if (Array.isArray(value)) return value.map(encodeBackupValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).map(([key, child]) => [key, encodeBackupValue(child)]));
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error('A saved record contains an unsupported value.');
}
export function decodeBackupValue(value: unknown): unknown {
  if (isRecord(value) && '$timestamp' in value) { if (Object.keys(value).length !== 1 || typeof value.$timestamp !== 'number' || !Number.isFinite(value.$timestamp)) throw new Error('Invalid timestamp in backup.'); return Timestamp.fromMillis(value.$timestamp); }
  if (Array.isArray(value)) return value.map(decodeBackupValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeBackupValue(child)]));
  return value;
}
export function encodeBackupRecord(value: Record<string, unknown>): Record<string, unknown> { const encoded = encodeBackupValue(value); if (!isRecord(encoded)) throw new Error('Invalid saved record.'); return encoded; }
export function decodeBackupRecord(value: Record<string, unknown>): Record<string, unknown> { const decoded = decodeBackupValue(value); if (!isRecord(decoded)) throw new Error('Invalid backup record.'); return decoded; }
