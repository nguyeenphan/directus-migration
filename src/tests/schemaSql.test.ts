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
    'DO $$ BEGIN\n' +
      '  ALTER TABLE "posts" ADD CONSTRAINT "posts_author_foreign" ' +
      'FOREIGN KEY ("author") REFERENCES "users" ("id") ON DELETE SET NULL;\n' +
      'EXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;',
  );

  assert.equal(addForeignKey({ collection: 'posts', field: 'author' }), null);
});

const defaultOf = (type: string, value: unknown) =>
  addColumn({
    collection: 'posts',
    field: 'x',
    schema: { data_type: type, default_value: value },
  })?.match(/DEFAULT (.+);$/)?.[1];

test('keyword and call defaults stay raw, text defaults stay quoted', () => {
  assert.equal(
    defaultOf('timestamp with time zone', 'CURRENT_TIMESTAMP'),
    'CURRENT_TIMESTAMP',
  );
  assert.equal(defaultOf('date', 'current_date'), 'current_date');
  assert.equal(
    defaultOf('integer', "nextval('posts_id_seq'::regclass)"),
    "nextval('posts_id_seq'::regclass)",
  );
  assert.equal(defaultOf('uuid', 'gen_random_uuid()'), 'gen_random_uuid()');
  assert.equal(defaultOf('text', 'Hello (world)'), "'Hello (world)'");
  assert.equal(
    defaultOf('timestamp with time zone', 'CURRENT_TIMESTAMP is a phrase'),
    "'CURRENT_TIMESTAMP is a phrase'",
  );
});

test('on a text column a default is the text itself, even when it reads like sql', () => {
  assert.equal(defaultOf('text', 'Hello(world)'), "'Hello(world)'");
  assert.equal(
    defaultOf('character varying', 'CURRENT_USER'),
    "'CURRENT_USER'",
  );
  assert.equal(defaultOf('character', 'now()'), "'now()'");
});

test('a collection is written after the folder it sits in', () => {
  const collection = (name: string, group: string | null) => ({
    collection: name,
    ...added({ collection: name, meta: { collection: name, group } }),
  });

  const sql = renderSchemaSql({
    collections: [
      collection('articles', 'content'),
      collection('content', 'site'),
      collection('site', null),
      collection('loose', 'already_on_the_target'),
    ],
  }).join('\n\n');

  const at = (values: string) => {
    const index = sql.indexOf(`VALUES (${values})`);
    assert.notEqual(index, -1, values);
    return index;
  };

  assert.ok(at(`'site', NULL`) < at(`'content', 'site'`));
  assert.ok(at(`'content', 'site'`) < at(`'articles', 'content'`));
  at(`'loose', 'already_on_the_target'`);
});

test('metadata inserts drop the auto increment id', () => {
  assert.equal(
    insertMetaRow('directus_fields', {
      id: 7,
      collection: 'posts',
      field: 'title',
    }),
    `INSERT INTO "directus_fields" ("collection", "field") ` +
      `SELECT 'posts', 'title' WHERE NOT EXISTS (SELECT 1 FROM "directus_fields" ` +
      `WHERE "collection" = 'posts' AND "field" = 'title');`,
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
      `SELECT 'posts', 'id', 'uuid' WHERE NOT EXISTS (SELECT 1 FROM "directus_fields" ` +
      `WHERE "collection" = 'posts' AND "field" = 'id');`,
  );
});

test('a new collection with no columns in the diff is reported, not skipped in silence', () => {
  const sections = renderSchemaSql({
    collections: [{ collection: 'posts', ...added({ collection: 'posts' }) }],
  }).join('\n\n');

  assert.match(sections, /posts — new, but the diff carries no columns/);
});

test('a table keyed by its own name still leans on its primary key', () => {
  assert.equal(
    insertMetaRow('directus_collections', { collection: 'posts' }),
    `INSERT INTO "directus_collections" ("collection") ` +
      `VALUES ('posts') ON CONFLICT DO NOTHING;`,
  );
});
