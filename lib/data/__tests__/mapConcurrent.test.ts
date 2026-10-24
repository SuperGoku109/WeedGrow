import { mapConcurrent } from '../mapConcurrent';
it('limits simultaneous work and preserves result order', async () => {
  jest.useFakeTimers(); let active = 0; let peak = 0;
  const job = mapConcurrent([1, 2, 3, 4, 5], 2, async item => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return item * 2; });
  await jest.runAllTimersAsync();
  expect(await job).toEqual([2, 4, 6, 8, 10]); expect(peak).toBe(2); jest.useRealTimers();
});
