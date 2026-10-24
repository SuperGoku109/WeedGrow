import { adviceInput } from '../adviceInputs';
it('ignores notes and snoozes but invalidates advice when the pin or setup changes', () => {
  const plant = { id: 'p', name: 'Plant', location: { lat: 1, lng: 2 }, locationRevision: 1, potSize: '10 L' } as any;
  expect(adviceInput({ ...plant, notes: 'A new note', careSnoozes: { watering: 123 } })).toEqual(adviceInput(plant));
  expect(adviceInput({ ...plant, locationRevision: 2 })).not.toEqual(adviceInput(plant));
  expect(adviceInput({ ...plant, potSize: '20 L' })).not.toEqual(adviceInput(plant));
});
