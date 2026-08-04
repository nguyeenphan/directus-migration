import assert from 'node:assert/strict';
import { test } from 'node:test';

import { relaxableFields, withoutUuidSpecial } from '@/api/constraints';

const ALIAS_REQUIRED = {
  collection: 'productLandingPageInformation',
  field: 'channels',
  type: 'alias',
  meta: { required: true },
  schema: null,
};

const NOT_NULL_COLUMN = {
  collection: 'products',
  field: 'title',
  meta: { required: false },
  schema: { is_nullable: false, is_unique: false, default_value: null },
};

const PRIMARY_KEY = {
  collection: 'products',
  field: 'id',
  meta: { required: false },
  schema: { is_primary_key: true, is_nullable: false, default_value: null },
};

const NOT_NULL_WITH_DEFAULT = {
  collection: 'products',
  field: 'status',
  meta: { required: false },
  schema: { is_nullable: false, is_unique: false, default_value: 'draft' },
};

const wanted = ['products', 'productLandingPageInformation'];

const names = (fields: Parameters<typeof relaxableFields>[0]) =>
  relaxableFields(fields, new Set(wanted)).map((field) => field.field);

test('a required alias field is never touched', () => {
  assert.deepEqual(names([ALIAS_REQUIRED]), []);
});

test('a NOT NULL column without a default is relaxed', () => {
  assert.deepEqual(names([NOT_NULL_COLUMN]), ['title']);
});

test('the primary key is left alone — the skeleton row carries it', () => {
  assert.deepEqual(names([PRIMARY_KEY]), []);
});

test('a NOT NULL column with a default needs no relaxing', () => {
  assert.deepEqual(names([NOT_NULL_WITH_DEFAULT]), []);
});

const UUID_FOREIGN_KEY = {
  collection: 'products',
  field: 'qrImage',
  meta: { required: false, special: ['uuid'] },
  schema: { is_nullable: true, is_unique: false, default_value: null },
};

test('a nullable uuid-special column is still relaxed — the special would invent a foreign key', () => {
  assert.deepEqual(names([UUID_FOREIGN_KEY]), ['qrImage']);
});

test('relaxing a uuid-special column drops only that special', () => {
  const [relaxed] = relaxableFields(
    [{ ...UUID_FOREIGN_KEY, meta: { special: ['uuid', 'cast-json'] } }],
    new Set(wanted),
  );

  assert.deepEqual(relaxed.meta.special, ['uuid', 'cast-json']);
});

test('only the uuid special is stripped for the data stage', () => {
  assert.deepEqual(withoutUuidSpecial(['uuid', 'cast-json']), ['cast-json']);
  assert.equal(withoutUuidSpecial(['uuid']), null);
  assert.equal(withoutUuidSpecial(null), null);
  assert.deepEqual(withoutUuidSpecial(['m2o']), ['m2o']);
});

test('a collection outside the run is untouched', () => {
  assert.deepEqual(
    relaxableFields([NOT_NULL_COLUMN], new Set(['somethingElse'])),
    [],
  );
});
