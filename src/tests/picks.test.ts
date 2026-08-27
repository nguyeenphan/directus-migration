import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  expandPicks,
  foreignKeysOf,
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

test('a picked record drags in what it points at, hop after hop', () => {
  const { picks, pulled } = expandPicks({
    picks: { articles: ['a1'], authors: [], teams: [] },
    relations,
    rows,
    primaryKeys,
  });

  assert.deepEqual(picks.articles, ['a1']);
  assert.deepEqual(picks.authors, ['u1']);
  assert.deepEqual(picks.teams, ['t1']);
  assert.deepEqual(pulled, { authors: 1, teams: 1 });
});

test('rows the target already holds are left where they are', () => {
  const { picks, pulled } = expandPicks({
    picks: { articles: ['a1'], authors: [] },
    relations,
    rows,
    primaryKeys,
    inTarget: new Map([['authors', new Set(['u1'])]]),
  });

  assert.deepEqual(picks.authors, []);
  assert.deepEqual(pulled, {});
});

test('a collection travelling whole is left alone', () => {
  const { picks } = expandPicks({
    picks: { articles: ['a1'] },
    relations,
    rows,
    primaryKeys,
  });

  assert.equal(picks.authors, undefined);
  assert.equal(picks.teams, undefined);
});

test('a reference to a row missing from the source is not invented', () => {
  const { picks } = expandPicks({
    picks: { articles: ['a1'], authors: [] },
    relations,
    rows: new Map([
      ['articles', [{ id: 'a1', author: 'gone' }]],
      ['authors', [{ id: 'u1' }]],
    ]),
    primaryKeys,
  });

  assert.deepEqual(picks.authors, []);
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
