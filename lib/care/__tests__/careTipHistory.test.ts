import type { Plant } from '@/firestoreModels';
import { careTipKey, findHandledCareTip, mergeCareTipHistory, type CareTipRecord } from '../careTipHistory';

const plant = { locationRevision: 4, locationTimeZone: 'UTC' } as Plant;
const beforeMidnight = new Date('2026-11-20T23:55:00Z');
const afterMidnight = new Date('2026-11-21T00:15:00Z');
const wind = 'wind-event-signature';
const tip: CareTipRecord = {
  key: careTipKey(plant, '2026-11-20', wind), day: '2026-11-20', kind: 'weather', title: 'Wind',
  detail: 'Secure loose supports.', seenAt: beforeMidnight.getTime() - 60000,
};

it('keeps handled weather quiet across midnight while changed conditions or location resurface', () => {
  const saved = { ...plant, careTipHistory: [{ ...tip, handledAt: beforeMidnight.getTime() }] };
  expect(findHandledCareTip(saved, wind, afterMidnight, 'weather')).toBeDefined();
  expect(findHandledCareTip(saved, wind + '-stronger', afterMidnight, 'weather')).toBeUndefined();
  expect(findHandledCareTip({ ...saved, locationRevision: 5 }, wind, afterMidnight, 'weather')).toBeUndefined();
  expect(findHandledCareTip(saved, wind, new Date('2026-11-21T23:56:00Z'), 'weather')).toBeUndefined();
  expect(findHandledCareTip(saved, wind, afterMidnight, 'watering')).toBeUndefined();
});

it('keeps the first review and first seen times when capture and retries overlap', () => {
  const handledAt = beforeMidnight.getTime();
  const handled = mergeCareTipHistory([tip], [{ ...tip, seenAt: handledAt }], handledAt);
  expect(handled).toEqual([{ ...tip, handledAt }]);
  expect(mergeCareTipHistory(handled, [tip])).toEqual(handled);
  expect(mergeCareTipHistory(handled, [tip], handledAt + 60000)).toEqual(handled);
});
