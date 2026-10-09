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

test('a singleton, which answers with its one object at every offset, is read once', async () => {
  let calls = 0;

  const rows = await readPages<{ id: number }>(200, async () => {
    calls += 1;
    return { id: 1 };
  });

  assert.deepEqual(rows, [{ id: 1 }]);
  assert.equal(calls, 1);
});

test('a singleton with no row yet reads as empty', async () => {
  assert.deepEqual(await readPages(200, async () => null), []);
});
