import { saveErrorMessage } from '../saveFeedback';
it('translates transport errors without losing validation or conflict detail', () => {
  expect(saveErrorMessage({ code: 'firestore/unavailable' })).toContain('Connection interrupted');
  expect(saveErrorMessage(new Error('This entry changed.'))).toBe('This entry changed.');
  expect(saveErrorMessage(null)).toBe('Could not save. Try again.');
});
