import { validateBackup } from '../backupFormat';
import { utf8Bytes } from '../backupLimits';
import { validateRestorePlan } from '../restorePlan';
import { journalCsv } from '../journalCsv';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
const plant = { name: 'Plant', status: 'active', growthStage: 'seedling', environment: 'outdoor', plantedIn: 'pot' };
const file = { format: 'weedgrow', version: 1, backupId: 'backup', exportedAt: '2026-10-24', records: [{ path: 'plants/p', data: plant }] };
it('validates restore paths before any writes, including duplicate or original destinations', () => {
  const backup = validateBackup(JSON.stringify(file));
  expect(() => validateRestorePlan({ operationId: 'op', paths: { 'plants/p': 'plants/p' } }, backup)).toThrow('destinations');
  expect(() => validateRestorePlan({ operationId: 'op', paths: { 'plants/p': 'groups/new' } }, backup)).toThrow('destinations');
  expect(validateRestorePlan({ operationId: 'op', paths: { 'plants/p': 'plants/new' } }, backup).paths['plants/p']).toBe('plants/new');
});
it('rejects timestamps outside Firestore bounds and malformed nested timestamp tags before restoring', () => {
  expect(() => validateBackup(JSON.stringify({ ...file, records: [{ path: 'plants/p', data: { ...plant, harvest: { timestamp: { $timestamp: 8000000000000000 } } } }] }))).toThrow('timestamp');
  expect(() => validateBackup(JSON.stringify({ ...file, records: [{ path: 'plants/p', data: { ...plant, createdAt: { $timestamp: 1, extra: true } } }] }))).toThrow('timestamp');
});
it('counts UTF-8 bytes and retains epoch dates in CSV', () => {
  expect(utf8Bytes('aé🌱')).toBe(7);
  const backup = validateBackup(JSON.stringify({ ...file, records: [...file.records, { path: 'plants/p/logs/l', data: { type: 'note', timestamp: { $timestamp: 0 } } }] }));
  expect(journalCsv(backup)).toContain('1970-01-01');
});
it('repairs only unambiguous legacy membership backlinks and rejects contradictory spaces', () => {
  const group = { path: 'groups/g', data: { name: 'Space', environment: 'outdoor', plantIds: ['p'] } };
  const backup = validateBackup(JSON.stringify({ ...file, records: [...file.records, group] }));
  expect(backup.records[0].data.groupId).toBe('g');
  expect(() => validateBackup(JSON.stringify({ ...file, records: [...file.records, group, { ...group, path: 'groups/other' }] }))).toThrow('more than one');
});
