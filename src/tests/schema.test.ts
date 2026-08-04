import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  attributeChanges,
  kindOfEntry,
  onlyCollections,
  stripMetaChanges,
} from '@/api/schema';

const DIRECTION_DIFF = {
  collection: 'languages',
  field: 'direction',
  diff: [
    { kind: 'E', path: ['meta', 'display'], lhs: null, rhs: 'labels' },
    {
      kind: 'E',
      path: ['meta', 'options', 'choices', 0, 'text'],
      lhs: 'Left to Right',
      rhs: '$t:left_to_right',
    },
    { kind: 'E', path: ['schema', 'is_nullable'], lhs: false, rhs: true },
  ],
};

test('a scalar flip reads target-then-source', () => {
  const [, , nullable] = attributeChanges(DIRECTION_DIFF);

  assert.deepEqual(nullable, {
    path: 'schema.is_nullable',
    before: 'false',
    after: 'true',
  });
});

test('an array index becomes part of the path', () => {
  const [, choice] = attributeChanges(DIRECTION_DIFF);

  assert.equal(choice.path, 'meta.options.choices.0.text');
  assert.equal(choice.before, 'Left to Right');
});

test('an empty side survives as null, for the caller to draw as a glyph', () => {
  const [display] = attributeChanges(DIRECTION_DIFF);

  assert.equal(display.before, null);
  assert.equal(display.after, 'labels');
});

test('added and removed fields carry no attribute rows', () => {
  const changes = attributeChanges({
    collection: 'languages',
    field: 'note',
    diff: [{ kind: 'N', path: ['meta'], rhs: { note: 'hi' } }],
  });

  assert.deepEqual(changes, []);
});

test('a difference that formats to nothing on both sides is dropped', () => {
  const changes = attributeChanges({
    collection: 'languages',
    field: 'code',
    diff: [{ kind: 'E', path: ['meta', 'note'], lhs: null, rhs: '' }],
  });

  assert.deepEqual(changes, []);
});

test('a collection that is genuinely new reads as an addition', () => {
  assert.equal(
    kindOfEntry({ collection: 'zzProbeNew', diff: [{ kind: 'N', rhs: {} }] }),
    'add',
  );
});

test('a new key inside meta is a modification, not a new collection', () => {
  assert.equal(
    kindOfEntry({
      collection: 'Field',
      diff: [
        { kind: 'N', path: ['meta', 'autosave_revision_interval'], rhs: null },
        { kind: 'N', path: ['meta', 'status'], rhs: 'active' },
      ],
    }),
    'modify',
  );
});

const DIFF = {
  collections: [
    {
      collection: 'Field',
      diff: [{ kind: 'N', path: ['meta', 'status'], rhs: 'active' }],
    },

    { collection: 'zzProbeNew', diff: [{ kind: 'N', rhs: {} }] },
  ],
  fields: [
    {
      collection: 'Step',
      field: 'type',
      diff: [{ kind: 'E', path: ['meta', 'required'], lhs: false, rhs: true }],
    },
    {
      collection: 'Step',
      field: 'stepId',
      diff: [
        { kind: 'E', path: ['schema', 'is_unique'], lhs: false, rhs: true },
      ],
    },
  ],
};

test('metadata-only entries are dropped entirely', () => {
  const stripped = stripMetaChanges(DIFF);

  assert.deepEqual(
    stripped.collections?.map((entry) => entry.collection),
    ['zzProbeNew'],
  );
  assert.deepEqual(
    stripped.fields?.map((entry) => entry.field),
    ['stepId'],
  );
});

test('a mixed entry keeps its structural half and loses the meta half', () => {
  const [entry] = stripMetaChanges({
    fields: [
      {
        collection: 'partner',
        field: 'name',
        diff: [
          { kind: 'E', path: ['meta', 'width'], lhs: 'half', rhs: 'full' },
          { kind: 'E', path: ['schema', 'is_unique'], lhs: false, rhs: true },
        ],
      },
    ],
  }).fields!;

  assert.deepEqual(
    entry.diff?.map((change) => change.path?.join('.')),
    ['schema.is_unique'],
  );
});

test('keys the filter does not understand survive untouched', () => {
  const stripped = stripMetaChanges({
    ...DIFF,
    systemFields: [{ collection: 'directus_users', field: 'x' }],
  } as Parameters<typeof stripMetaChanges>[0]);

  assert.deepEqual((stripped as Record<string, unknown>).systemFields, [
    { collection: 'directus_users', field: 'x' },
  ]);
});

test('onlyCollections drops entries for unticked collections', () => {
  const filtered = onlyCollections(
    {
      collections: [{ collection: 'keep' }, { collection: 'mine' }],
      fields: [{ collection: 'mine', field: 'title' }],
      relations: [{ collection: 'mine', field: 'author' }],
    },
    new Set(['keep']),
  );

  assert.deepEqual(filtered.collections, [{ collection: 'keep' }]);
  assert.deepEqual(filtered.fields, []);
  assert.deepEqual(filtered.relations, []);
});
