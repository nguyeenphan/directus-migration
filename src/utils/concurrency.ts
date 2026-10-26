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

/**
 * `mapLimit`, but an item whose work fails a test it is allowed to survive —
 * a busy server's 503, say — is set aside and run again at the end, one at a
 * time, once the fan-out is over. The retry's own failure rejects the call,
 * as does any failure `canRetry` turns down.
 */
export const mapLimitRetryingLast = async <TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  work: (item: TItem, index: number) => Promise<TResult>,
  canRetry: (error: unknown) => boolean,
  onQueued?: (item: TItem, error: unknown) => void,
): Promise<TResult[]> => {
  const queued: number[] = [];

  const results = await mapLimit(items, limit, async (item, index) => {
    try {
      return await work(item, index);
    } catch (error) {
      if (!canRetry(error)) throw error;

      queued.push(index);
      onQueued?.(item, error);

      return null as TResult;
    }
  });

  for (const index of queued) {
    results[index] = await work(items[index], index);
  }

  return results;
};
