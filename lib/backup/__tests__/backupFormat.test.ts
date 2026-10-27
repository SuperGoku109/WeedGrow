import { validateBackup, escapeCsv } from '../backupFormat';
const plant = { name: 'Test', growthStage: 'seedling', environment: 'outdoor', plantedIn: 'pot', status: 'active' };
const backup = { format: 'weedgrow', version: 1, backupId: 'backup-a', exportedAt: '2026-10-20', records: [{ path: 'plants/p', data: plant }] };
it('accepts a valid versioned backup', () => { expect(validateBackup(JSON.stringify(backup)).records).toHaveLength(1); });
it('rejects paths outside the supported garden collections', () => { expect(() => validateBackup(JSON.stringify({ ...backup, records: [{ path: 'users/admin', data: {} }] }))).toThrow(); });
it('rejects duplicate records instead of silently overwriting them', () => { expect(() => validateBackup(JSON.stringify({ ...backup, records: [backup.records[0], backup.records[0]] }))).toThrow('duplicate'); });
it('rejects malformed or cross-plant photo references before writing', () => { expect(() => validateBackup(JSON.stringify({ ...backup, records: [{ path: 'plants/p', data: { ...plant, imageUri: 'firestore-photo:plants/other/photoAssets/a' } }] }))).toThrow('reference'); });
it('rejects unsupported versions', () => { expect(() => validateBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow('supported'); });
it('accepts large gardens and histories for resumable restore', () => {
  const records = Array.from({ length: 12 }, (_, index) => ({ path: `plants/p${index}`, data: plant }));
  const logs = Array.from({ length: 420 }, (_, index) => ({ path: `plants/p0/logs/log${index}`, data: { type: 'note', timestamp: { $timestamp: Date.now() }, description: 'History' } }));
  expect(validateBackup(JSON.stringify({ ...backup, records: [...records, ...logs] })).records).toHaveLength(432);
});

it('neutralizes spreadsheet formulas and escapes CSV text', () => { expect(escapeCsv('=IMPORTXML("x")')).toBe('"\'=IMPORTXML(""x"")"'); expect(escapeCsv('a,b')).toBe('"a,b"'); });

it('preserves event precision and submission dates in log and photo backups', () => {
  const metadata = { timestamp: { $timestamp: 1000 }, calendarDay: '2026-09-10', timeZone: 'Africa/Johannesburg', occurrencePrecision: 'date', recordedAt: { $timestamp: 2000 } };
  const result = validateBackup(JSON.stringify({ ...backup, records: [...backup.records, { path: 'plants/p/logs/log', data: { type: 'note', ...metadata } }, { path: 'plants/p/progressPics/photo', data: { imageUrl: 'https://example.test/photo.jpg', ...metadata } }] }));
  expect(result.records[1].data).toMatchObject(metadata); expect(result.records[2].data).toMatchObject(metadata);
});
it('rejects malformed precision and submission metadata', () => {
  expect(() => validateBackup(JSON.stringify({ ...backup, records: [...backup.records, { path: 'plants/p/logs/log', data: { type: 'note', timestamp: { $timestamp: 0 }, occurrencePrecision: 'guessed' } }] }))).toThrow('precision');
  expect(() => validateBackup(JSON.stringify({ ...backup, records: [...backup.records, { path: 'plants/p/logs/log', data: { type: 'note', timestamp: { $timestamp: 0 }, recordedAt: 'not a timestamp' } }] }))).toThrow('submission');
});
