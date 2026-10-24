import { assertValidPlantFields, validatePlantFields, PlantValidationError } from '../plantValidation';
it('applies consistent name and numeric limits at write boundaries', () => {
  expect(() => assertValidPlantFields({ name: ' ', height: Infinity })).toThrow(PlantValidationError);
  expect(validatePlantFields({ name: 'a'.repeat(101), height: 10001, ageDays: 1.5 })).toEqual(expect.objectContaining({ name: expect.any(String), height: expect.any(String), ageDays: expect.any(String) }));
  expect(validatePlantFields({ name: ' Plant ', height: 0, ageDays: 36500, soilPh: '14', location: { lat: 0, lng: 0 } })).toEqual({});
});
it('rejects invalid enums, measurements and non-finite coordinates', () => {
  expect(Object.keys(validatePlantFields({ status: 'other', soilPh: '-1', environment: 'roof', location: { lat: NaN, lng: 18 } }))).toEqual(expect.arrayContaining(['status', 'soilPh', 'environment', 'location']));
});
it('validates only supplied fields and supports clearing optional values', () => {
  expect(validatePlantFields({ notes: 'Repairing a legacy plant', height: null, soilPh: '', location: null })).toEqual({});
});
