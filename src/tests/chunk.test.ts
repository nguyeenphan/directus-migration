import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chunkArray } from '@/utils/chunk';

test('splits into fixed-size batches and keeps order', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('an exact multiple produces no trailing empty batch', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4], 2), [
    [1, 2],
    [3, 4],
  ]);
});

test('an empty array produces no batches at all', () => {
  assert.deepEqual(chunkArray([], 50), []);
});
