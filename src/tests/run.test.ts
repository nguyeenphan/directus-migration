import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sequenceResetSql, type TRun, wroteData } from '@/models/run';

const runWith = (units: TRun['units']) => ({ units }) as TRun;

test('a table with rows leaves the next id at MAX + 1', () => {
  const sql = sequenceResetSql([{ collection: 'partner', primaryKey: 'id' }]);

  assert.match(sql, /SELECT COUNT\(\*\) FROM "partner"\) > 0\);$/);
  assert.match(sql, /pg_get_serial_sequence\('"partner"', 'id'\)/);
  assert.match(sql, /COALESCE\(\(SELECT MAX\("id"\) FROM "partner"\), 1\)/);
});

test('the identifier and its quoting survive into the statement', () => {
  const sql = sequenceResetSql([
    { collection: 'Field_translations', primaryKey: 'id' },
  ]);

  assert.ok(sql.includes('\'"Field_translations"\''));
  assert.ok(sql.includes('FROM "Field_translations"'));
});

test('one statement per collection, each on its own line', () => {
  const sql = sequenceResetSql([
    { collection: 'a', primaryKey: 'id' },
    { collection: 'b', primaryKey: 'code' },
  ]);

  assert.equal(sql.split('\n').length, 2);
  assert.ok(sql.split('\n')[1].includes("'code'"));
});

test('nothing to reset produces nothing to run', () => {
  assert.equal(sequenceResetSql([]), '');
});

const unit = (name: string, stage: TRun['units'][number]['stage']) => ({
  name,
  stage,
  status: 'done' as const,
  written: 1,
  deleted: 0,
  error: null,
});

test('a schema-only run has nothing a rollback could restore', () => {
  assert.equal(
    wroteData(runWith([unit('backup', 'backup'), unit('schema', 'schema')])),
    false,
  );
});

test('a run that touched a collection does', () => {
  assert.equal(
    wroteData(runWith([unit('backup', 'backup'), unit('partner', 'data')])),
    true,
  );
});
