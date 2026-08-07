import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isTransient, withRetry } from '@/utils/retry';

const withStatus = (status: number) => ({ response: { status } });

test('server errors and throttling are transient', () => {
  assert.equal(isTransient(withStatus(502)), true);
  assert.equal(isTransient(withStatus(500)), true);
  assert.equal(isTransient(withStatus(429)), true);
  assert.equal(isTransient(withStatus(408)), true);
  assert.equal(isTransient(new TypeError('fetch failed')), true);
});

test('client errors are not transient', () => {
  assert.equal(isTransient(withStatus(400)), false);
  assert.equal(isTransient(withStatus(403)), false);
  assert.equal(isTransient({ errors: [{ message: 'duplicate key' }] }), false);
});

test('a transient failure is retried until it succeeds', async () => {
  let calls = 0;

  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw withStatus(503);
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('a duplicate key is thrown on the first attempt', async () => {
  let calls = 0;

  await assert.rejects(
    withRetry(async () => {
      calls += 1;
      throw withStatus(400);
    }),
  );

  assert.equal(calls, 1);
});

test('retries give up after the attempt budget', async () => {
  let calls = 0;

  await assert.rejects(
    withRetry(async () => {
      calls += 1;
      throw withStatus(500);
    }, 2),
  );

  assert.equal(calls, 2);
});
