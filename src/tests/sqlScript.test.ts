import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  deleteStatement,
  insertRow,
  insertStub,
  quoteIdent,
  sqlLiteral,
  updateStatement,
} from '@/api/sqlScript';

test('identifiers are quoted, and embedded quotes are doubled', () => {
  assert.equal(quoteIdent('users'), '"users"');
  assert.equal(quoteIdent('weird"name'), '"weird""name"');
});

test('sql literals cover null, boolean, number and string', () => {
  assert.equal(sqlLiteral(null), 'NULL');
  assert.equal(sqlLiteral(undefined), 'NULL');
  assert.equal(sqlLiteral(true), 'TRUE');
  assert.equal(sqlLiteral(false), 'FALSE');
  assert.equal(sqlLiteral(42), '42');
  assert.equal(sqlLiteral("O'Brien"), "'O''Brien'");
});

test('objects and arrays serialize as JSON string literals', () => {
  assert.equal(sqlLiteral({ a: 1 }), `'{"a":1}'`);
});

test('insert stub only ever writes the primary key, batched into one statement', () => {
  const sql = insertStub('articles', 'id', [1, 2, 3]);

  assert.equal(
    sql,
    `INSERT INTO "articles" ("id") VALUES (1), (2), (3) ON CONFLICT ("id") DO NOTHING;`,
  );
});

test('update statement skips the primary key and nulls audit fields', () => {
  const sql = updateStatement('articles', 'id', ['id', 'title', 'user_updated'], {
    id: 1,
    title: 'New title',
    user_updated: 'someone',
  });

  assert.equal(
    sql,
    `UPDATE "articles" SET "title" = 'New title', "user_updated" = NULL WHERE "id" = 1;`,
  );
});

test('insert row writes every listed column in one shot', () => {
  const sql = insertRow('directus_files', 'id', ['id', 'title'], {
    id: 'abc',
    title: "Gấu's file",
  });

  assert.equal(
    sql,
    `INSERT INTO "directus_files" ("id", "title") VALUES ('abc', 'Gấu''s file') ON CONFLICT ("id") DO NOTHING;`,
  );
});

test('delete statement lists every key', () => {
  assert.equal(
    deleteStatement('articles', 'id', ['1', '2']),
    `DELETE FROM "articles" WHERE "id" IN ('1', '2');`,
  );
});
