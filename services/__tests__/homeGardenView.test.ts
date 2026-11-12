import { readGardenListView, saveGardenListView, saveGardenScrollOffset } from '../homeGardenView';
it('keeps filter choices scoped to the garden and account, including after a delayed scroll event', () => {
  const options = { sort: 'nameDesc', stage: 'seedling', environment: 'indoor' } as const;
  saveGardenListView('filter-owner', 'garden', { query: 'Blue', status: 'active', offset: 0, options });
  saveGardenScrollOffset('filter-owner', 'garden', 100);
  expect(readGardenListView('filter-owner', 'garden').options).toEqual(options);
  expect(readGardenListView('filter-owner', 'other-garden').options).toBeUndefined();
  expect(readGardenListView('other-owner', 'garden').options).toBeUndefined();
});
it('keeps query, past filter, and scroll independently for each garden and account', () => {
  saveGardenListView('owner', 'tent', { query: 'Blue', status: 'harvested', offset: 240 });
  saveGardenListView('owner', 'patio', { query: '', status: 'active', offset: 80 });
  expect(readGardenListView('owner', 'tent')).toEqual({ query: 'Blue', status: 'harvested', offset: 240 });
  expect(readGardenListView('owner', 'patio').offset).toBe(80);
  expect(readGardenListView('different-owner', 'tent')).toEqual({ query: '', status: 'active', offset: 0 });
});
it('does not let a delayed scroll event revert a changed filter', () => {
  saveGardenListView('owner', 'garden', { query: 'Olive', status: 'harvested', offset: 100 });
  saveGardenListView('owner', 'garden', { query: '', status: 'active', offset: 0 });
  saveGardenScrollOffset('owner', 'garden', 20);
  expect(readGardenListView('owner', 'garden')).toEqual({ query: '', status: 'active', offset: 20 });
});
