import { buildInitialFormState, buildUpdates, validateForm } from '../form/editPlantForm';
import { buildSectionUpdates, sections } from '../form/plantSectionForm';
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
