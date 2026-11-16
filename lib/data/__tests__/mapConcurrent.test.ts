import { mapConcurrent } from '../mapConcurrent';
it('limits simultaneous work and preserves result order', async () => {
  jest.useFakeTimers(); let active = 0; let peak = 0;
  const job = mapConcurrent([1, 2, 3, 4, 5], 2, async item => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return item * 2; });
  await jest.runAllTimersAsync();
  expect(await job).toEqual([2, 4, 6, 8, 10]); expect(peak).toBe(2); jest.useRealTimers();
});

it('handles empty work and a pool larger than the input without duplicating jobs', async () => {
  const work = jest.fn(async (item: number) => item * 2);
  expect(await mapConcurrent([], 5, work)).toEqual([]);
  expect(work).not.toHaveBeenCalled();
  expect(await mapConcurrent([1, 2], 5, work)).toEqual([2, 4]);
  expect(work).toHaveBeenCalledTimes(2);
});

it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid pool size %s before starting work', async concurrency => {
  const work = jest.fn(async (item: number) => item);
  await expect(mapConcurrent([1], concurrency, work)).rejects.toThrow('Concurrency must be a positive whole number.');
  expect(work).not.toHaveBeenCalled();
});
