import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addColumn,
  addForeignKey,
  columnType,
  createTable,
  insertMetaRow,
  renderSchemaSql,
} from '@/lib/directus/schemaSql';

const added = (rhs: unknown) => ({ diff: [{ kind: 'N', path: [], rhs }] });

test('column types carry length, precision and auto increment', () => {
  assert.equal(
    columnType({ data_type: 'varchar', max_length: 255 }),
    'varchar(255)',
  );
  assert.equal(
    columnType({
      data_type: 'numeric',
      numeric_precision: 10,
      numeric_scale: 2,
    }),
    'numeric(10, 2)',
  );
  assert.equal(
    columnType({ data_type: 'integer', has_auto_increment: true }),
    'serial',
  );
  assert.equal(columnType({ data_type: 'uuid' }), 'uuid');
});

test('a new collection becomes a create table with its primary key', () => {
  const sql = createTable('posts', [
    {
      collection: 'posts',
      field: 'id',
      schema: { data_type: 'uuid', is_primary_key: true, is_nullable: false },
    },
    {
      collection: 'posts',
      field: 'title',
      schema: { data_type: 'varchar', max_length: 255, default_value: 'x' },
    },
  ]);

  assert.equal(
    sql,
    'CREATE TABLE IF NOT EXISTS "posts" (\n' +
      '  "id" uuid NOT NULL,\n' +
      `  "title" varchar(255) DEFAULT 'x',\n` +
      '  PRIMARY KEY ("id")\n);',
  );
});

test('alias fields with no column contribute no ddl', () => {
  assert.equal(
    addColumn({ collection: 'posts', field: 'tags', schema: null }),
    null,
  );
});

test('function defaults are not quoted as strings', () => {
  assert.equal(
    addColumn({
      collection: 'posts',
      field: 'created',
      schema: { data_type: 'timestamp', default_value: 'now()' },
    }),
    'ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "created" timestamp DEFAULT now();',
  );
});

test('relations become foreign keys, falling back to a derived constraint name', () => {
  assert.equal(
    addForeignKey({
      collection: 'posts',
      field: 'author',
      schema: {
        foreign_key_table: 'users',
        foreign_key_column: 'id',
        on_delete: 'SET NULL',
      },
    }),
    'ALTER TABLE "posts" ADD CONSTRAINT "posts_author_foreign" ' +
      'FOREIGN KEY ("author") REFERENCES "users" ("id") ON DELETE SET NULL;',
  );

  assert.equal(addForeignKey({ collection: 'posts', field: 'author' }), null);
});

test('metadata inserts drop the auto increment id', () => {
  assert.equal(
    insertMetaRow('directus_fields', {
      id: 7,
      collection: 'posts',
      field: 'title',
    }),
    `INSERT INTO "directus_fields" ("collection", "field") ` +
      `VALUES ('posts', 'title') ON CONFLICT DO NOTHING;`,
  );
});

test('fields of a new collection go into its create table, not into alter table', () => {
  const sections = renderSchemaSql({
    collections: [{ collection: 'posts', ...added({ collection: 'posts' }) }],
    fields: [
      {
        collection: 'posts',
        field: 'id',
        ...added({
          collection: 'posts',
          field: 'id',
          schema: { data_type: 'uuid', is_primary_key: true },
        }),
      },
      {
        collection: 'authors',
        field: 'bio',
        ...added({
          collection: 'authors',
          field: 'bio',
          schema: { data_type: 'text' },
        }),
      },
    ],
  }).join('\n\n');

  assert.match(sections, /CREATE TABLE IF NOT EXISTS "posts"/);
  assert.match(
    sections,
    /ALTER TABLE "authors" ADD COLUMN IF NOT EXISTS "bio" text;/,
  );
  assert.doesNotMatch(sections, /ALTER TABLE "posts"/);
});

test('changes that are not additions are reported instead of written', () => {
  const sections = renderSchemaSql({
    fields: [
      {
        collection: 'posts',
        field: 'title',
        diff: [{ kind: 'E', path: ['schema', 'max_length'] }],
      },
      { collection: 'posts', field: 'legacy', diff: [{ kind: 'D', path: [] }] },
    ],
  }).join('\n\n');

  assert.match(sections, /WARNING: not everything is written as SQL/);
  assert.match(sections, /posts\.title — changed in the source/);
  assert.match(sections, /posts\.legacy — removed in the source/);
});

test('csv meta columns are written as comma separated text, not json', () => {
  assert.equal(
    insertMetaRow('directus_fields', {
      collection: 'posts',
      field: 'id',
      special: ['uuid'],
    }),
    `INSERT INTO "directus_fields" ("collection", "field", "special") ` +
      `VALUES ('posts', 'id', 'uuid') ON CONFLICT DO NOTHING;`,
  );
});

test('a new collection with no columns in the diff is reported, not skipped in silence', () => {
  const sections = renderSchemaSql({
    collections: [{ collection: 'posts', ...added({ collection: 'posts' }) }],
  }).join('\n\n');

  assert.match(sections, /posts — new, but the diff carries no columns/);
});
