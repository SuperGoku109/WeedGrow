import { assertUnchanged } from '../editConflict';
it('rejects conflicting fields but permits unrelated updates', () => {
  const before = { name: 'Seedling', location: { lat: 1, lng: 2 }, locationMode: 'custom', groupId: null, notes: '' };
  expect(() => assertUnchanged({ ...before, name: 'Updated elsewhere' }, { name: 'My edit' }, before)).toThrow('another tab');
  expect(() => assertUnchanged({ ...before, notes: 'New observation' }, { name: 'My edit' }, before)).not.toThrow();
});
it('detects a space change while the location form was open', () => {
  const before = { location: { lat: 1, lng: 2 }, locationMode: 'custom', groupId: 'patio' };
  expect(() => assertUnchanged({ ...before, groupId: 'greenhouse' }, { location: { lat: 3, lng: 4 } }, before)).toThrow('another tab');
});
