/** A bounded worker pool preserves input order without flooding the provider. */
export async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, work: (item: T) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive whole number.');
  const results: R[] = new Array(items.length); let next = 0;
  const worker = async () => { while (next < items.length) { const index = next++; results[index] = await work(items[index]); } };
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(concurrency))) }, worker));
  return results;
}
