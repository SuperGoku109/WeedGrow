import { validateActivityForm } from '../form/activityForm';
const today = '2026-10-27';
it('records watering immediately without an amount or a routine', () => {
  expect(validateActivityForm('watering', '', today, {}, today)).toEqual({ errors: {}, values: {}, description: '' });
});
it('records a standalone measurement without requiring an observation', () => {
  const result = validateActivityForm('measurements', '', today, { heightCm: '40', ph: '6.5' }, today);
  expect(result.errors).toEqual({}); expect(result.values).toEqual({ heightCm: 40, ph: 6.5 });
  expect(validateActivityForm('measurements', '', today, {}, today).errors.description).toBeTruthy();
});
it('requires valid repeat fields only when opting into automation', () => {
  const raw = { repeatChanged: '1', repeatEnabled: '1', repeatEveryDays: '2', repeatTime: '08:00', repeatWaterMl: '500', repeatTimeZone: 'Africa/Johannesburg' };
  expect(validateActivityForm('watering', '', today, raw, today).values.wateringRepeatChange).toMatchObject({ enabled: true, everyDays: 2, waterMl: 500, startOn: today });
  expect(validateActivityForm('watering', '', today, { ...raw, repeatWaterMl: '' }, today).errors.repeatWaterMl).toBeTruthy();
  expect(validateActivityForm('watering', '', today, { repeatChanged: '1' }, today).values.wateringRepeatChange).toEqual({ enabled: false });
});
it('accepts zero and decimal commas without including measurements from another activity type', () => {
  const result = validateActivityForm('feeding', '', today, { nutrientMlPerL: '2,5', waterMl: '500', ph: '0' }, today);
  expect(result.errors).toEqual({}); expect(result.values).toEqual({ nutrientMlPerL: 2.5 });
  expect(validateActivityForm('measurements', '', today, { ph: '0' }, today).values).toEqual({ ph: 0 });
});
it.each(['-1', 'Infinity', 'NaN', '2e3', '1,000,000', '12ml', '1000001'])('rejects invalid water measurement %s at the field', input => {
  const result = validateActivityForm('watering', '', today, { waterMl: input }, today);
  expect(result.errors.waterMl).toBeTruthy(); expect(result.values).not.toHaveProperty('waterMl');
});
it('allows a qualitative soil check without forcing a redundant observation', () => {
  const result = validateActivityForm('health', '', today, { moistureState: 'DRY' }, today);
  expect(result.errors).toEqual({}); expect(result.description).toBe('Health measurements recorded.');
});
it.each(['watering', 'feeding', 'pests', 'training', 'health', 'notes'] as const)('ignores new general measurements in %s while preserving saved legacy readings', category => {
  expect(validateActivityForm(category, 'Checked', today, { ph: '6', heightCm: '30', soilMoisture: '40' }, today).values).toEqual({});
  expect(validateActivityForm(category, 'Checked', today, { ph: '7' }, today, { ph: 6.5, heightCm: 20 }).values).toEqual({ ph: 6.5, heightCm: 20 });
});
it('requires meaningful observations for notes, pests and training and rejects future dates', () => {
  for (const type of ['notes', 'pests', 'training'] as const) expect(validateActivityForm(type, ' ', today, {}, today).errors.description).toBeTruthy();
  expect(validateActivityForm('watering', '', '2026-10-28', {}, today).errors.date).toBeTruthy();
});
