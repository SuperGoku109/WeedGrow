import type { Plant } from '@/firestoreModels';
import { DEFAULT_PLANT_LIST_OPTIONS as defaults, plantListChoiceCount, selectPlantList } from '../plantListOptions';

function plant(id: string, name: string, added: number | null, fields: Partial<Plant> = {}) {
  return { id, name, strain: '', status: 'active', growthStage: 'vegetative', environment: 'outdoor', createdAt: added === null ? null : { toMillis: () => added }, ...fields } as Plant & { id: string };
}
const plants = [plant('a', 'Plant 10', 100), plant('b', 'plant 2', 200, { environment: 'indoor', strain: 'Blue Dream', growthStage: 'seedling' }), plant('c', 'Old plant', 50, { status: 'harvested' }), plant('d', 'Pending', null)];

it('combines name/strain search, status, stage and environment without changing the original collection', () => {
  const original = plants.map(item => item.id);
  expect(selectPlantList(plants, '  BLUE  ', 'active', { ...defaults, environment: 'indoor', stage: 'seedling' }).map(item => item.id)).toEqual(['b']);
  expect(selectPlantList(plants, 'Blue', 'active', { ...defaults, environment: 'outdoor' })).toEqual([]);
  expect(plants.map(item => item.id)).toEqual(original);
});
it('sorts by creation time in both directions and leaves pending timestamps last', () => {
  expect(selectPlantList(plants, '', 'active').map(item => item.id)).toEqual(['b', 'a', 'd']);
  expect(selectPlantList(plants, '', 'active', { ...defaults, sort: 'oldest' }).map(item => item.id)).toEqual(['a', 'b', 'd']);
});
it('sorts names naturally, ignores case, and breaks equal-name ties consistently', () => {
  const entries = [plant('z', 'Plant 2', 1), plant('a', 'plant 2', 1), plant('b', 'Plant 10', 1)];
  expect(selectPlantList(entries, '', 'active', { ...defaults, sort: 'nameAsc' }).map(item => item.id)).toEqual(['a', 'z', 'b']);
  expect(selectPlantList(entries, '', 'active', { ...defaults, sort: 'nameDesc' }).map(item => item.id)).toEqual(['b', 'z', 'a']);
});
it('keeps active and past plants separate and supports the existing specific past-status controls', () => {
  expect(selectPlantList(plants, '', 'past').map(item => item.id)).toEqual(['c']);
  expect(selectPlantList(plants, '', 'harvested').map(item => item.id)).toEqual(['c']);
  expect(selectPlantList(plants, '', 'dead')).toEqual([]);
});
it('handles an empty list, missing timestamps and equal creation dates deterministically', () => {
  expect(selectPlantList([], '', 'active')).toEqual([]);
  const entries = [plant('b', 'B', 5), plant('a', 'A', 5), plant('c', 'C', null, { createdAt: undefined })];
  expect(selectPlantList(entries, '', 'active').map(item => item.id)).toEqual(['a', 'b', 'c']);
});
it('counts changed choices and returns to zero when reset', () => {
  expect(plantListChoiceCount(defaults, 'active')).toBe(0);
  expect(plantListChoiceCount({ sort: 'nameAsc', stage: 'seedling', environment: 'indoor' }, 'past')).toBe(4);
});

it('matches any selected value within a group and combines groups with search and status', () => {
  const options = { ...defaults, stage: ['seedling', 'vegetative'], environment: ['indoor', 'outdoor'] } as const;
  const selected = { ...options, stage: [...options.stage], environment: [...options.environment] };
  expect(selectPlantList(plants, '', 'active', selected).map(item => item.id)).toEqual(['b', 'a', 'd']);
  expect(selectPlantList(plants, 'Blue', 'active', selected).map(item => item.id)).toEqual(['b']);
  expect(selectPlantList(plants, '', 'active', { ...selected, environment: ['indoor'] }).map(item => item.id)).toEqual(['b']);
  expect(selectPlantList(plants, '', 'active', { ...selected, stage: ['vegetative'], environment: ['indoor'] })).toEqual([]);
  expect(plantListChoiceCount(selected, 'active')).toBe(4);
});

it('treats empty selections as all and remains compatible with saved single-value choices', () => {
  expect(selectPlantList(plants, '', 'active', { ...defaults, stage: [], environment: [] }).map(item => item.id)).toEqual(['b', 'a', 'd']);
  expect(selectPlantList(plants, '', 'active', { ...defaults, stage: ['seedling'], environment: ['indoor'] })).toEqual(selectPlantList(plants, '', 'active', { ...defaults, stage: 'seedling', environment: 'indoor' }));
  expect(plantListChoiceCount({ ...defaults, stage: [], environment: [] }, 'active')).toBe(0);
});

it('filters pre-flowering from recorded signs without inventing a separate stored growth stage', () => {
  const entries = [
    plant('observed', 'Observed', 1, { preflowerObservedOn: '2020-01-01' }),
    plant('plain', 'Plain vegetative', 1),
    plant('flowering', 'Flowering', 1, { growthStage: 'flowering', preflowerObservedOn: '2020-01-01' }),
    plant('future', 'Future', 1, { preflowerObservedOn: '9999-01-01' }),
    plant('invalid', 'Invalid', 1, { preflowerObservedOn: 'not-a-date' }),
  ];
  expect(selectPlantList(entries, '', 'active', { ...defaults, stage: ['preflower'] }).map(item => item.id)).toEqual(['observed']);
  expect(selectPlantList(entries, '', 'active', { ...defaults, stage: ['preflower', 'flowering'] }).map(item => item.id)).toEqual(['flowering', 'observed']);
});
