import { groupEditValues, selectGroups, type CollectionGroup, type CollectionPlant } from '../groupCollection';

const group = (id: string, name: string, environment = 'indoor', seconds = 0) => ({ id, name, environment, plantIds: [], createdAt: { seconds } } as unknown as CollectionGroup);
const groups = [group('b', 'Beta', 'outdoor', 30), group('a', 'Alpha', 'indoor', 10), group('c', 'Courtyard', 'greenhouse', 20)];
const plants = { b: [{ id: 'p1', name: 'Fern' }, { id: 'p2', name: 'Ivy' }] as CollectionPlant[], a: [{ id: 'p3', name: 'Palm' }] as CollectionPlant[] };

describe('group collection browsing', () => {
  it('sorts by name without mutating the source', () => {
    expect(selectGroups(groups, plants, '', 'all', 'name').map(g => g.id)).toEqual(['a', 'b', 'c']);
    expect(groups[0].id).toBe('b');
  });
  it('searches names with trimmed case-insensitive text', () => {
    expect(selectGroups(groups, plants, '  ALPHA ', 'all', 'name').map(g => g.id)).toEqual(['a']);
  });
  it('finds groups by member name', () => {
    expect(selectGroups(groups, plants, 'fern', 'all', 'name').map(g => g.id)).toEqual(['b']);
  });
  it('combines search and environment', () => {
    expect(selectGroups(groups, plants, 'fern', 'indoor', 'name')).toEqual([]);
    expect(selectGroups(groups, plants, '', 'greenhouse', 'name').map(g => g.id)).toEqual(['c']);
  });
  it('sorts newest first and handles empty memberships', () => {
    expect(selectGroups(groups, plants, '', 'all', 'newest').map(g => g.id)).toEqual(['b', 'c', 'a']);
    expect(selectGroups(groups, plants, '', 'all', 'size').map(g => g.id)).toEqual(['b', 'a', 'c']);
  });
  it('returns no matches for unrelated queries', () => {
    expect(selectGroups(groups, plants, 'missing', 'all', 'name')).toEqual([]);
  });
});

describe('group edits', () => {
  it('requires a meaningful name', () => {
    expect(() => groupEditValues(group('a', '  '))).toThrow('name');
  });
  it('trims names and deduplicates members', () => {
    expect(groupEditValues({ ...groups[0], name: ' Beta ', plantIds: ['p1', 'p1'], weatherSourcePlantId: 'p1' })).toEqual({ name: 'Beta', plantIds: ['p1'], weatherSourcePlantId: 'p1' });
  });
  it('clears a removed source without undefined Firestore values', () => {
    expect(groupEditValues({ ...groups[0], plantIds: [], weatherSourcePlantId: 'p1' }).weatherSourcePlantId).toBe('');
    expect(Object.values(groupEditValues(groups[0]))).not.toContain(undefined);
  });
});
