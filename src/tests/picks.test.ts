import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  foreignKeysOf,
  pullReferenced,
  type TPickRelation,
} from '@/lib/directus/picks';
import type { TRow } from '@/models/common';

const relations: TPickRelation[] = [
  { collection: 'articles', field: 'author', related: 'authors' },
  { collection: 'authors', field: 'team', related: 'teams' },
];

const rows = new Map<string, TRow[]>([
  [
    'articles',
    [
      { id: 'a1', author: 'u1' },
      { id: 'a2', author: 'u2' },
    ],
  ],
  [
    'authors',
    [
      { id: 'u1', team: 't1' },
      { id: 'u2', team: 't2' },
    ],
  ],
  ['teams', [{ id: 't1' }, { id: 't2' }]],
]);

const primaryKeys = new Map([
  ['articles', 'id'],
  ['authors', 'id'],
  ['teams', 'id'],
]);

test('an unticked record a travelling one points at travels too, hop after hop', () => {
  const { excluded, pulled } = pullReferenced({
    excluded: { articles: ['a2'], authors: ['u1', 'u2'], teams: ['t1', 't2'] },
    relations,
    rows,
    primaryKeys,
  });

  assert.deepEqual(excluded.articles, ['a2']);
  assert.deepEqual(excluded.authors, ['u2']);
  assert.deepEqual(excluded.teams, ['t2']);
  assert.deepEqual(pulled, { authors: 1, teams: 1 });
});

test('rows the target already holds are left where they are', () => {
  const { excluded, pulled } = pullReferenced({
    excluded: { articles: ['a2'], authors: ['u1', 'u2'] },
    relations,
    rows,
    primaryKeys,
    inTarget: new Map([['authors', new Set(['u1'])]]),
  });

  assert.deepEqual(excluded.authors, ['u1', 'u2']);
  assert.deepEqual(pulled, {});
});

test('a collection travelling whole is left alone', () => {
  const { excluded } = pullReferenced({
    excluded: { articles: ['a2'] },
    relations,
    rows,
    primaryKeys,
  });

  assert.equal(excluded.authors, undefined);
  assert.equal(excluded.teams, undefined);
});

test('an exclusion emptied by the pull is dropped altogether', () => {
  const { excluded } = pullReferenced({
    excluded: { authors: ['u1'] },
    relations,
    rows,
    primaryKeys,
  });

  assert.equal(excluded.authors, undefined);
});

test('an unticked key the source does not hold is left unticked', () => {
  const { excluded, pulled } = pullReferenced({
    excluded: { authors: ['gone'] },
    relations,
    rows: new Map([
      ['articles', [{ id: 'a1', author: 'gone' }]],
      ['authors', [{ id: 'u1' }]],
    ]),
    primaryKeys,
  });

  assert.deepEqual(excluded.authors, ['gone']);
  assert.deepEqual(pulled, {});
});

test('keys into system collections are not part of the closure', () => {
  const snapshot = {
    relations: [
      {
        collection: 'articles',
        field: 'cover',
        related_collection: 'directus_files',
      },
      {
        collection: 'articles',
        field: 'author',
        related_collection: 'authors',
      },
      {
        collection: 'directus_files',
        field: 'folder',
        related_collection: 'directus_folders',
      },
    ],
  } as unknown as Parameters<typeof foreignKeysOf>[0];

  assert.deepEqual(foreignKeysOf(snapshot), [
    { collection: 'articles', field: 'author', related: 'authors' },
  ]);
});
