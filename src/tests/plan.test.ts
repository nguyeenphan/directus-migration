import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  destructiveChanges,
  excludedKeys,
  findParent,
  groupCollections,
  isDeleteOnly,
  keepsRow,
  missingDependencies,
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

const counted = (
  toCreate: number,
  toUpdate: number,
  extraInTarget: number,
): TDataChange => ({
  ...dataRow('partner', false),
  toCreate,
  toUpdate,
  extraInTarget,
});

test('a collection with nothing but extras is delete-only', () => {
  assert.equal(isDeleteOnly(counted(0, 0, 2)), true);
});

test('any row to write means it is not delete-only', () => {
  assert.equal(isDeleteOnly(counted(1, 0, 2)), false);
  assert.equal(isDeleteOnly(counted(0, 1, 2)), false);
});

test('a collection with no extras is not delete-only', () => {
  assert.equal(isDeleteOnly(counted(0, 0, 0)), false);
  assert.equal(isDeleteOnly(counted(3, 0, 0)), false);
});

test('an unknown update count does not read as delete-only', () => {
  assert.equal(isDeleteOnly({ ...counted(0, 0, 2), toUpdate: null }), true);
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

test('a collection with nothing unticked keeps every row', () => {
  const excluded = excludedKeys({ other: ['1'] }, 'articles');

  assert.equal(excluded.size, 0);
  assert.ok(keepsRow(excluded, 42));
});

test('an unticked key is the only one left behind', () => {
  const excluded = excludedKeys({ articles: ['1', '2'] }, 'articles');

  assert.ok(!keepsRow(excluded, 1));
  assert.ok(keepsRow(excluded, 3));
});

test('a record the review list never showed still travels', () => {
  const excluded = excludedKeys({ articles: ['1'] }, 'articles');

  assert.ok(keepsRow(excluded, 'beyond-the-cap'));
});

test('a collection that is both dropped and narrowed counts once', () => {
  const entry = {
    collection: 'posts',
    kind: 'delete' as const,
    dependents: [],
    fields: [
      {
        field: 'title',
        kind: 'delete' as const,
        sourceType: null,
        targetType: null,
        attributes: [],
        destructive: true,
      },
    ],
  };

  assert.equal(
    destructiveChanges({
      collections: [entry],
      relations: [],
      unchanged: [],
      compatibility: {} as never,
    }).length,
    1,
  );
});

const dependent = (
  collection: string,
  dependsOn: string[],
  toCreate = 0,
): TDataChange => ({ ...dataRow(collection, false), dependsOn, toCreate });

test('a selected collection pointing at an unselected one is reported', () => {
  const rows = [
    dependent('articles', ['authors']),
    dependent('authors', [], 3),
  ];

  assert.deepEqual(missingDependencies(rows, new Set(['articles'])), [
    { collection: 'articles', missing: ['authors'] },
  ]);
});

test('a parent the target already holds in full is not reported', () => {
  const rows = [dependent('articles', ['authors']), dependent('authors', [])];

  assert.deepEqual(missingDependencies(rows, new Set(['articles'])), []);
});

test('a parent that travels along is not reported', () => {
  const rows = [
    dependent('articles', ['authors']),
    dependent('authors', [], 3),
  ];

  assert.deepEqual(
    missingDependencies(rows, new Set(['articles', 'authors'])),
    [],
  );
});
