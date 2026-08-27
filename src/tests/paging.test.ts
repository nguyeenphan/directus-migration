import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readPages } from '@/lib/directus/paging';

const pagesOf = (rows: number[], perCall: number[]) => {
  const seen: number[] = [];

  const fetchPage = async (offset: number) => {
    const size = perCall[seen.length] ?? 0;
    seen.push(offset);

    return rows.slice(offset, offset + size);
  };

  return { fetchPage, seen };
};

test('a short page in the middle does not end the read', async () => {
  const rows = Array.from({ length: 12 }, (_, index) => index);
  const { fetchPage } = pagesOf(rows, [5, 2, 5, 5]);

  assert.deepEqual(await readPages(5, fetchPage), rows);
});

test('the offset steps by the rows actually returned, never by the page size', async () => {
  const rows = Array.from({ length: 7 }, (_, index) => index);
  const { fetchPage, seen } = pagesOf(rows, [3, 3, 3, 3]);

  assert.deepEqual(await readPages(5, fetchPage), rows);
  assert.deepEqual(seen, [0, 3, 6, 7]);
});

test('an empty first page reads nothing', async () => {
  const { fetchPage, seen } = pagesOf([], [0]);

  assert.deepEqual(await readPages(5, fetchPage), []);
  assert.deepEqual(seen, [0]);
});
