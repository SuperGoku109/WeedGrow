import { validateActivityForm } from '../form/activityForm';
const today = '2026-10-27';
it('accepts zero and decimal commas without including measurements from another activity type', () => {
  const result = validateActivityForm('feeding', '', today, { nutrientMlPerL: '2,5', waterMl: '500', ph: '0' }, today);
  expect(result.errors).toEqual({}); expect(result.values).toEqual({ nutrientMlPerL: 2.5, ph: 0 });
});
it.each(['-1', 'Infinity', 'NaN', '2e3', '1,000,000', '12ml', '1000001'])('rejects invalid water measurement %s at the field', input => {
  const result = validateActivityForm('watering', '', today, { waterMl: input }, today);
  expect(result.errors.waterMl).toBeTruthy(); expect(result.values).not.toHaveProperty('waterMl');
});
it('allows a health measurement without forcing a redundant observation', () => {
  const result = validateActivityForm('health', '', today, { soilMoisture: '25' }, today);
  expect(result.errors).toEqual({}); expect(result.description).toBe('Health measurements recorded.');
});
it('requires meaningful observations for notes, pests and training and rejects future dates', () => {
  for (const type of ['notes', 'pests', 'training'] as const) expect(validateActivityForm(type, ' ', today, {}, today).errors.description).toBeTruthy();
  expect(validateActivityForm('watering', '', '2026-10-28', {}, today).errors.date).toBeTruthy();
});
