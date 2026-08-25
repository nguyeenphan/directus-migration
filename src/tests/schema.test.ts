import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  attributeChanges,
  compatibilityOf,
  kindOfEntry,
  onlyCollections,
  pruneUnknownMeta,
  stripMetaChanges,
  unknownColumns,
  withoutUnknownKeys,
} from '@/api/schema';
import { unknownMetaKeys } from '@/models/plan';

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

const snapshotOf = (
  directus: string,
  vendor: string,
  meta: Record<string, unknown>,
) =>
  ({
    version: 1,
    directus,
    vendor,
    collections: [{ collection: 'article', meta }],
    fields: [{ collection: 'article', field: 'title', meta: { sort: 1 } }],
    relations: [],
  }) as unknown as Parameters<typeof compatibilityOf>[0];

const V12 = snapshotOf('11.17.1', 'postgres', {
  icon: 'article',
  status: 'active',
  autosave_revision_interval: null,
});

const V11 = snapshotOf('11.17.4', 'postgres', { icon: 'article' });

test('meta drift is read from the snapshots, not the reported versions', () => {
  const compatibility = compatibilityOf(V12, V11);

  assert.deepEqual(compatibility.unknownMeta.collections, [
    'autosave_revision_interval',
    'status',
  ]);
  assert.deepEqual(compatibility.unknownMeta.fields, []);
});

test('a downgraded source keeps the columns of the version it came from', () => {
  // Both report 11.17.x, yet the source still carries its v12 columns.
  const compatibility = compatibilityOf(V12, V11);

  assert.equal(compatibility.sourceVersion, '11.17.1');
  assert.equal(compatibility.targetVersion, '11.17.4');
  assert.ok(unknownMetaKeys(compatibility).length > 0);
});

test('an empty target teaches us nothing, so nothing drifts', () => {
  const empty = snapshotOf('11.17.4', 'postgres', {});
  (empty as { collections: unknown[] }).collections = [];

  assert.deepEqual(compatibilityOf(V12, empty).unknownMeta.collections, []);
});

test('unknown meta keys are pruned off newly created objects', () => {
  const pruned = pruneUnknownMeta(
    {
      collections: [
        {
          collection: 'article',
          diff: [
            {
              kind: 'N',
              rhs: {
                collection: 'article',
                meta: { icon: 'article', status: 'active' },
              },
            },
          ],
        },
      ],
    },
    { collections: ['status'], fields: [], relations: [] },
  );

  const rhs = pruned.collections?.[0]?.diff?.[0]?.rhs as {
    meta: Record<string, unknown>;
  };

  assert.deepEqual(rhs.meta, { icon: 'article' });
});

test('pruning leaves a diff alone when the target knows every key', () => {
  const diff = {
    collections: [
      { collection: 'article', diff: [{ kind: 'N', rhs: { meta: { x: 1 } } }] },
    ],
  };

  assert.deepEqual(
    pruneUnknownMeta(diff, { collections: [], fields: [], relations: [] }),
    diff,
  );
});

test('a fresh target with no collections is still measured, via its columns', () => {
  const fresh = snapshotOf('11.17.4', 'postgres', {});
  (fresh as { collections: unknown[] }).collections = [];

  const columns = {
    collections: new Set(['icon']),
    fields: new Set<string>(),
    relations: new Set<string>(),
  };

  assert.deepEqual(compatibilityOf(V12, fresh, columns).unknownMeta.collections, [
    'autosave_revision_interval',
    'status',
  ]);
});

test('the column lookup wins over what the target objects happen to carry', () => {
  const columns = {
    collections: new Set(['icon', 'status', 'autosave_revision_interval']),
    fields: new Set<string>(),
    relations: new Set<string>(),
  };

  assert.deepEqual(compatibilityOf(V12, V11, columns).unknownMeta.collections, []);
});

test('a target that cannot be read drifts by nothing, rather than by everything', () => {
  assert.deepEqual(unknownColumns(['id', 'title'], new Set()), []);
  assert.deepEqual(withoutUnknownKeys({ id: 1, title: 'x' }, new Set()), {
    id: 1,
    title: 'x',
  });
});

test('columns the target lacks are named, not silently skipped', () => {
  assert.deepEqual(
    unknownColumns(['id', 'title', 'focal_point_x'], new Set(['id', 'title'])),
    ['focal_point_x'],
  );
});

test('a row is pruned to what the target can actually store', () => {
  assert.deepEqual(
    withoutUnknownKeys(
      { id: 1, title: 'x', tus_data: null },
      new Set(['id', 'title']),
    ),
    { id: 1, title: 'x' },
  );
});
