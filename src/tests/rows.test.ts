import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asRows } from '@/utils/rows';

test('a normal collection page passes through untouched', () => {
  const page = [{ id: 1 }, { id: 2 }];

  assert.equal(asRows(page), page);
});

test('a singleton object becomes a one-row page', () => {
  assert.deepEqual(asRows({ id: 1, title: 'Settings' }), [
    { id: 1, title: 'Settings' },
  ]);
});

test('an unsaved singleton reads as no rows, not as one empty row', () => {
  assert.deepEqual(asRows(null), []);
  assert.deepEqual(asRows(undefined), []);
});

test('an empty page still terminates a pagination loop', () => {
  assert.ok(asRows({ id: 1 }).length < 100);
  assert.equal(asRows([]).length, 0);
});
