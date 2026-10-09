/**
 * `Promise.all` over `items`, but never more than `limit` in flight. Results
 * keep the order of `items`; the first rejection rejects the whole call.
 */
export const mapLimit = async <TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  work: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );

  return results;
};
