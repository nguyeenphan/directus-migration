import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findParent,
  groupCollections,
  sequenceResetsIn,
  type TDataChange,
} from '@/models/plan';

const dataRow = (
  collection: string,
  hasAutoIncrement: boolean,
): TDataChange => ({
  collection,
  parent: null,
  toCreate: 0,
  toUpdate: 0,
  extraInTarget: 0,
  primaryKey: 'id',
  hasAutoIncrement,
});

test('only selected auto-increment collections need a sequence reset', () => {
  const rows = [
    dataRow('partner', true),
    dataRow('products', true),
    dataRow('config', false),
  ];

  assert.deepEqual(sequenceResetsIn(rows, new Set(['partner', 'config'])), [
    { collection: 'partner', primaryKey: 'id' },
  ]);
});

test('a uuid-keyed selection asks for nothing', () => {
  assert.deepEqual(
    sequenceResetsIn([dataRow('config', false)], new Set(['config'])),
    [],
  );
});

const ALL = [
  'homeLoanGeneralInfo',
  'homeLoanGeneralInfo_translations',
  'homeLoanGeneralInfo_translations_instructionAction',
  'products',
  'products_translations',
  'handbook',
];

const change = (collection: string): TDataChange => ({
  ...dataRow(collection, false),
  parent: findParent(collection, ALL),
  toCreate: 1,
});

test('a collection with no prefix in the list has no parent', () => {
  assert.equal(findParent('handbook', ALL), null);
  assert.equal(findParent('products', ALL), null);
});

test('a derived table folds under the collection people think about', () => {
  assert.equal(findParent('products_translations', ALL), 'products');
});

test('a third-level name folds to the root, not to the level above it', () => {
  assert.equal(
    findParent('homeLoanGeneralInfo_translations_instructionAction', ALL),
    'homeLoanGeneralInfo',
  );
});

test('every group is anchored on a row of its own, so none renders disabled', () => {
  const groups = groupCollections(ALL.map(change));

  for (const group of groups) {
    assert.ok(
      group.own !== null,
      `group "${group.parent}" has no own row, its checkbox would be disabled`,
    );
  }
});

test('the whole three-level branch collapses into one group', () => {
  const groups = groupCollections(ALL.map(change));
  const branch = groups.find((group) => group.parent === 'homeLoanGeneralInfo');

  assert.deepEqual(
    branch?.derived.map((row) => row.collection),
    [
      'homeLoanGeneralInfo_translations',
      'homeLoanGeneralInfo_translations_instructionAction',
    ],
  );
});
