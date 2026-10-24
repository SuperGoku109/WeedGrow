import { decodeDraft, INITIAL_PLANT_FORM } from '../draftStorage';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
const draft = { version: 1, plantId: 'stable-retry-id', savedAt: '2026-10-17T12:00:00Z', step: 3, form: { ...INITIAL_PLANT_FORM, name: 'Fern', imageUri: 'data:image/jpeg;base64,AAAA', lastWateredOn: '2026-10-16' } };
it('restores the step, prepared photo, history and retry ID', () => {
  expect(decodeDraft(JSON.stringify(draft))).toMatchObject(draft);
});
it.each([null, 'bad json', '{}', JSON.stringify({ ...draft, version: 2 }), JSON.stringify({ ...draft, step: 7 }), JSON.stringify({ ...draft, form: { ...draft.form, ageDays: 12 } })])('rejects corrupt or unsupported drafts', raw => {
  expect(decodeDraft(raw)).toBeNull();
});
it('does not restore expired device-only or browser object URLs', () => {
  expect(decodeDraft(JSON.stringify({ ...draft, form: { ...draft.form, imageUri: 'blob:expired' } }))?.form.imageUri).toBe('');
});
