import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapLimit, mapLimitRetryingLast } from '@/utils/concurrency';

test('results keep the order of the input, never more than the limit at once', async () => {
  let running = 0;
  let peak = 0;

  const doubled = await mapLimit([5, 1, 3, 2, 4], 2, async (value) => {
    running += 1;
    peak = Math.max(peak, running);

    await new Promise((resolve) => setTimeout(resolve, value));

    running -= 1;
    return value * 2;
  });

  assert.deepEqual(doubled, [10, 2, 6, 4, 8]);
  assert.equal(peak, 2);
});

test('an empty list resolves to nothing', async () => {
  assert.deepEqual(await mapLimit([], 4, async () => 1), []);
});

test('one failure rejects the whole call', async () => {
  await assert.rejects(
    mapLimit([1, 2], 2, async (value) => {
      if (value === 2) throw new Error('boom');
      return value;
    }),
    /boom/,
  );
});

test('a transient failure is queued and run again at the end', async () => {
  const order: string[] = [];
  const failedOnce = new Set<string>();
  const queued: string[] = [];

  const results = await mapLimitRetryingLast(
    ['a', 'b', 'c'],
    2,
    async (item) => {
      order.push(item);
      if (item === 'b' && !failedOnce.has(item)) {
        failedOnce.add(item);
        throw new Error('503');
      }
      return item.toUpperCase();
    },
    (error) => (error as Error).message === '503',
    (item) => queued.push(item),
  );

  assert.deepEqual(results, ['A', 'B', 'C']);
  assert.deepEqual(queued, ['b']);
  assert.equal(order.at(-1), 'b');
});

test('a failure the test turns down rejects the whole call', async () => {
  await assert.rejects(
    mapLimitRetryingLast(
      ['a'],
      1,
      async () => {
        throw new Error('400');
      },
      () => false,
    ),
    /400/,
  );
});
