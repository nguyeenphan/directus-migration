import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inParentOrder } from '@/api/runner';

const order = (folders: { id: string; parent: string | null }[]) =>
  inParentOrder(folders).map((folder) => String(folder.id));

const isBefore = (names: string[], first: string, second: string) =>
  names.indexOf(first) < names.indexOf(second);

test('a parent is always written before its child', () => {
  const names = order([
    { id: 'grandchild', parent: 'child' },
    { id: 'child', parent: 'root' },
    { id: 'root', parent: null },
  ]);

  assert.deepEqual(names, ['root', 'child', 'grandchild']);
});

test('several trees are all ordered', () => {
  const names = order([
    { id: 'b-child', parent: 'b' },
    { id: 'a-child', parent: 'a' },
    { id: 'a', parent: null },
    { id: 'b', parent: null },
  ]);

  assert.equal(names.length, 4);
  assert.ok(isBefore(names, 'a', 'a-child'));
  assert.ok(isBefore(names, 'b', 'b-child'));
});

test('a folder whose parent is outside the set is treated as a root', () => {
  const names = order([
    { id: 'orphan-child', parent: 'orphan' },
    { id: 'orphan', parent: 'not-in-this-set' },
  ]);

  assert.deepEqual(names, ['orphan', 'orphan-child']);
});

test('a parent cycle is passed through instead of hanging', () => {
  const names = order([
    { id: 'a', parent: 'b' },
    { id: 'b', parent: 'a' },
    { id: 'free', parent: null },
  ]);

  assert.equal(names[0], 'free');
  assert.deepEqual([...names].sort(), ['a', 'b', 'free']);
});

test('every folder is returned exactly once', () => {
  const names = order([
    { id: 'root', parent: null },
    { id: 'child', parent: 'root' },
    { id: 'cycle-a', parent: 'cycle-b' },
    { id: 'cycle-b', parent: 'cycle-a' },
  ]);

  assert.equal(new Set(names).size, 4);
  assert.equal(names.length, 4);
});
