import { buildInitialFormState, buildUpdates, validateForm } from '../form/editPlantForm';
import { buildSectionUpdates, buildAllSectionUpdates, sections } from '../form/plantSectionForm';
import type { Plant } from '@/firestoreModels';
const plant = { name: 'Plant', strain: '', status: 'active', environment: 'outdoor', plantedIn: 'pot', growthStage: 'seedling', ageKnown: false, location: { lat: 0, lng: 0 } } as Plant;
it('keeps unchanged fields out of full-editor writes and preserves zero coordinates', () => {
  const form = buildInitialFormState(plant);
  expect(buildUpdates(form, plant)).toEqual({});
  expect(buildUpdates({ ...form, name: ' Renamed ' }, plant)).toEqual({ name: 'Renamed' });
  expect(validateForm({ ...form, height: 'Infinity' })).toHaveProperty('height');
});
it('converts section drafts with the plant calendar day and shared reminder limits', () => {
  const basics = Object.fromEntries(sections.Basics.map(field => [field.key, String((plant as unknown as Record<string, unknown>)[field.key] || '')]));
  const updates = buildSectionUpdates('Basics', { ...basics, ageDays: '2', startedOn: '' }, 'custom', plant, '2026-10-25');
  expect(updates.startedOn).toBe('2026-10-23');
  const care = Object.fromEntries(sections['Care plan'].map(field => [field.key, '']));
  expect(() => buildSectionUpdates('Care plan', { ...care, reminderType: 'interval', intervalDays: '366' }, 'custom', plant)).toThrow('365');
});

it('preserves an estimated start date when unrelated profile fields change', () => {
  const estimated = { ...plant, startedOn: '2026-10-01', ageDays: 10, ageEstimated: true, ageKnown: true };
  const values = Object.fromEntries(sections.Basics.map(field => [field.key, String((estimated as unknown as Record<string, unknown>)[field.key] ?? '')]));
  const updates = buildSectionUpdates('Basics', { ...values, name: 'New name' }, 'custom', estimated, '2026-10-27', 'estimate');
  expect(updates.startedOn).toBe('2026-10-01'); expect(updates.ageEstimated).toBe(true); expect(updates).not.toHaveProperty('ageDays');
});
it('keeps a known start date when editing identity and recalculates age', () => {
  const known = { ...plant, startedOn: '2026-10-01', ageDays: 10, ageKnown: true };
  const values = Object.fromEntries(sections.Basics.map(field => [field.key, String((known as unknown as Record<string, unknown>)[field.key] ?? '')]));
  const updates = buildSectionUpdates('Basics', { ...values, name: 'New name' }, 'custom', known, '2026-10-27', 'date');
  expect(updates).toMatchObject({ startedOn: '2026-10-01', ageDays: 26, ageEstimated: false, ageKnown: true });
  expect(updates).not.toHaveProperty('status');
});

it('does not invent a start date from an unchanged legacy recorded age', () => {
  const legacy = { ...plant, ageDays: 50, ageKnown: true };
  const values = Object.fromEntries(sections.Basics.map(field => [field.key, String((legacy as unknown as Record<string, unknown>)[field.key] ?? '')]));
  const updates = buildSectionUpdates('Basics', { ...values, name: 'New name' }, 'custom', legacy, '2026-10-27', 'estimate');
  expect(updates.startedOn).toBeNull(); expect(updates).not.toHaveProperty('ageDays');
});

const allValues = () => {
  const source = { ...plant, lat: 0, lng: 0, strainType: 'unknown', reminderType: 'none' };
  return Object.fromEntries(Object.values(sections).flat().map(field => [field.key, String((source as unknown as Record<string, unknown>)[field.key] ?? '')]));
};
it('leaves every unchanged section out of the single-page editor update', () => {
  const values = allValues();
  expect(buildAllSectionUpdates(values, { values, ageMode: 'estimate', locationMode: 'custom' }, 'custom', plant, '2026-10-28', 'estimate')).toEqual({});
});
it('combines profile and routine changes without rewriting the untouched location', () => {
  const values = allValues();
  const updates = buildAllSectionUpdates({ ...values, name: 'Renamed', feedingFrequency: 'Weekly' }, { values, ageMode: 'estimate', locationMode: 'custom' }, 'custom', plant, '2026-10-28', 'estimate');
  expect(updates).toMatchObject({ name: 'Renamed', feedingFrequency: 'Weekly' });
  expect(updates).not.toHaveProperty('location'); expect(updates).not.toHaveProperty('soilType');
});
it('validates every changed section before returning a combined update', () => {
  const values = allValues();
  expect(() => buildAllSectionUpdates({ ...values, name: 'Renamed', reminderType: 'interval', intervalDays: '0' }, { values, ageMode: 'estimate', locationMode: 'custom' }, 'custom', plant, '2026-10-28', 'estimate')).toThrow('Care plan:');
});
it('includes location mode changes even when the pin is unchanged', () => {
  const values = allValues();
  const updates = buildAllSectionUpdates(values, { values, ageMode: 'estimate', locationMode: 'custom' }, 'space', plant, '2026-10-28', 'estimate');
  expect(updates).toMatchObject({ locationMode: 'space', location: { lat: 0, lng: 0 } });
  expect(updates).not.toHaveProperty('name');
});
