import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapLimit } from '@/utils/concurrency';

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
