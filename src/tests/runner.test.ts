import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  requestStop,
  resumeAfterBackup,
  rollbackRun,
  startRun,
} from '@/lib/directus/runner';
import type { TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import { isFinished, type TRun, type TRunRequest } from '@/models/run';

import { fakeDirectus, httpError } from './support/fakeDirectus';

let hosts = 0;

const articles = (rows: TRow[]) => ({
  articles: {
    fields: { title: { nullable: false }, body: {} },
    rows,
  },
});

const pair = (
  sourceRows: TRow[],
  targetRows: TRow[],
  extra: Partial<TRunRequest> = {},
) => {
  hosts += 1;

  const source = fakeDirectus({ collections: articles(sourceRows) });
  const target = fakeDirectus({ collections: articles(targetRows) });

  const ends = {
    source: { url: `https://source-${hosts}.test`, token: 's' },
    target: { url: `https://target-${hosts}.test`, token: 't' },
  };

  const connect = (connection: TConnection) =>
    connection === ends.source ? source.client : target.client;

  const request: TRunRequest = {
    ...ends,
    collections: ['articles'],
    excluded: {},
    applySchema: false,
    schemaCollections: [],
    force: false,
    mirrorData: false,
    ...extra,
  };

  return { source, target, request, connect };
};

const until = async (done: () => boolean) => {
  for (let turn = 0; turn < 2000 && !done(); turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.ok(done(), 'the run never reached the expected state');
};

const toBackupGate = (run: TRun) =>
  until(() => run.status === 'awaiting-backup' || isFinished(run));

const complete = async (run: TRun) => {
  await toBackupGate(run);
  resumeAfterBackup(run);
  await until(() => isFinished(run));
};

const itemWrites = (target: ReturnType<typeof fakeDirectus>) =>
  target.writes().filter((request) => request.path.startsWith('/items/'));

test('only new and changed rows are written', async () => {
  const { target, request, connect } = pair(
    [
      { id: 1, title: 'same', body: 'a' },
      { id: 2, title: 'edited', body: 'b' },
      { id: 3, title: 'new', body: 'c' },
    ],
    [
      { id: 1, title: 'same', body: 'a' },
      { id: 2, title: 'old', body: 'b' },
    ],
  );

  const run = startRun(request, connect);
  await complete(run);

  assert.equal(run.status, 'succeeded');
  assert.equal(run.units.find((unit) => unit.name === 'articles')?.written, 2);
  assert.deepEqual(run.createdKeys.articles, ['3']);

  const written = itemWrites(target)
    .filter((write) => write.method === 'PATCH')
    .flatMap((write) => (write.body as TRow[]).map((row) => row.id));

  assert.deepEqual(written, [3, 2]);
  assert.deepEqual(
    target.rows('articles').map((row) => row.title),
    ['same', 'edited', 'new'],
  );
});

test('the constraints relaxed for the bare-key pass are put back', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'new', body: null }],
    [],
  );

  const run = startRun(request, connect);
  await complete(run);

  assert.equal(run.status, 'succeeded');
  assert.equal(target.field('articles', 'title')?.schema.is_nullable, false);
  assert.equal(run.error, null);
});

test('nothing is written before the backup has been handed over', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'new', body: null }],
    [],
  );

  const run = startRun(request, connect);
  await toBackupGate(run);

  assert.equal(run.status, 'awaiting-backup');
  assert.equal(run.hasBackup, true);
  assert.deepEqual(target.writes(), []);

  requestStop(run);
  await until(() => isFinished(run));

  assert.equal(run.status, 'stopped');
  assert.deepEqual(target.writes(), []);
});

test('a backup that cannot be read stops the run before any write', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'new', body: null }],
    [{ id: 9, title: 'kept', body: null }],
  );

  target.state.failWhen = (call) =>
    call.method === 'GET' && call.path === '/items/articles'
      ? httpError(400, 'INVALID_QUERY')
      : undefined;

  const run = startRun(request, connect);
  await until(() => isFinished(run));

  assert.equal(run.status, 'failed');
  assert.equal(run.hasBackup, false);
  assert.deepEqual(target.writes(), []);
});

test('an unticked record stays behind', async () => {
  const { target, request, connect } = pair(
    [
      { id: 1, title: 'goes', body: null },
      { id: 2, title: 'stays', body: null },
    ],
    [],
    { excluded: { articles: ['2'] } },
  );

  const run = startRun(request, connect);
  await complete(run);

  assert.deepEqual(
    target.rows('articles').map((row) => row.id),
    [1],
  );
});

test('mirror mode deletes what only the target holds, never an unticked record', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'kept', body: null }],
    [
      { id: 1, title: 'kept', body: null },
      { id: 2, title: 'extra', body: null },
      { id: 3, title: 'spared', body: null },
    ],
    { mirrorData: true, excluded: { articles: ['3'] } },
  );

  const run = startRun(request, connect);
  await complete(run);

  assert.deepEqual(
    target.rows('articles').map((row) => row.id),
    [1, 3],
  );
  assert.equal(run.units.find((unit) => unit.name === 'articles')?.deleted, 1);
});

test('a run whose fill fails does not read as a success, and says what it left', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'new', body: null }],
    [],
  );

  target.state.failWhen = (call) =>
    call.method === 'PATCH' && call.path === '/items/articles'
      ? httpError(400, 'INVALID_PAYLOAD')
      : undefined;

  const run = startRun(request, connect);
  await complete(run);

  const unit = run.units.find((entry) => entry.name === 'articles');

  assert.equal(unit?.status, 'failed');
  assert.notEqual(run.status, 'succeeded');

  // The bare key is still there, so NOT NULL cannot come back — and the run
  // has to say so rather than report restored constraints.
  assert.equal(target.field('articles', 'title')?.schema.is_nullable, true);
  assert.match(run.error ?? '', /could not be restored/);
  assert.ok(run.log.some((line) => /hold only their key/.test(line.message)));
});

test('a failure outside any one collection fails the run', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'new', body: null }],
    [],
  );

  target.state.failWhen = (call) =>
    call.method === 'GET' && call.path === '/fields'
      ? httpError(400, 'INVALID_QUERY')
      : undefined;

  const run = startRun(request, connect);
  await complete(run);

  assert.notEqual(run.status, 'succeeded');
  assert.ok(run.error);
  assert.deepEqual(itemWrites(target), []);
});

test('a second run on the same target is refused while one is going', async () => {
  const { request, connect } = pair([{ id: 1, title: 'a', body: null }], []);

  const run = startRun(request, connect);
  await toBackupGate(run);

  assert.throws(() => startRun(request, connect), /still in progress/);

  requestStop(run);
  await until(() => isFinished(run));
});

test('rollback puts the target back the way the backup found it', async () => {
  const before = [
    { id: 1, title: 'old', body: 'a' },
    { id: 2, title: 'extra', body: 'b' },
  ];

  const { target, request, connect } = pair(
    [
      { id: 1, title: 'edited', body: 'a' },
      { id: 3, title: 'new', body: 'c' },
    ],
    before,
    { mirrorData: true },
  );

  const run = startRun(request, connect);
  await complete(run);

  assert.deepEqual(
    target.rows('articles').map((row) => row.id),
    [1, 3],
  );

  await rollbackRun(run, connect);

  assert.equal(run.status, 'rolled-back');
  assert.deepEqual(
    target
      .rows('articles')
      .map(({ id, title, body }) => ({ id, title, body }))
      .sort((a, b) => Number(a.id) - Number(b.id)),
    before,
  );
  assert.equal(target.field('articles', 'title')?.schema.is_nullable, false);
});

test('a rollback that failed can simply be run again', async () => {
  const { target, request, connect } = pair(
    [{ id: 1, title: 'edited', body: 'a' }],
    [{ id: 1, title: 'old', body: 'a' }],
  );

  const run = startRun(request, connect);
  await complete(run);

  target.state.failWhen = (call) =>
    call.method === 'PATCH' && call.path === '/items/articles'
      ? httpError(400, 'INVALID_PAYLOAD')
      : undefined;

  await assert.rejects(rollbackRun(run, connect));
  assert.equal(run.status, 'succeeded');

  target.state.failWhen = undefined;
  await rollbackRun(run, connect);

  assert.equal(run.status, 'rolled-back');
  assert.equal(target.rows('articles')[0].title, 'old');
});

test('a masked field is never carried over', async () => {
  hosts += 1;

  const collections = (rows: TRow[]) => ({
    members: {
      fields: { name: {}, secret: { special: ['hash'] } },
      rows,
    },
  });

  const source = fakeDirectus({
    collections: collections([
      { id: 1, name: 'new name', secret: '**********' },
    ]),
  });
  const target = fakeDirectus({
    collections: collections([{ id: 1, name: 'name', secret: 'real-hash' }]),
  });

  const ends = {
    source: { url: `https://source-${hosts}.test`, token: 's' },
    target: { url: `https://target-${hosts}.test`, token: 't' },
  };

  const connect = (connection: TConnection) =>
    connection === ends.source ? source.client : target.client;

  const run = startRun(
    {
      ...ends,
      collections: ['members'],
      excluded: {},
      applySchema: false,
      schemaCollections: [],
      force: false,
      mirrorData: false,
    },
    connect,
  );
  await complete(run);

  assert.deepEqual(target.rows('members'), [
    {
      id: 1,
      name: 'new name',
      secret: 'real-hash',
      user_created: null,
      date_created: null,
      user_updated: null,
      date_updated: null,
    },
  ]);
});

const tooLarge = () =>
  httpError(
    400,
    'INVALID_PAYLOAD',
    'Invalid payload. request entity too large.',
  );

test('a batch the target finds too large is split until it fits', async () => {
  const { target, request, connect } = pair(
    [1, 2, 3, 4, 5].map((id) => ({ id, title: `new ${id}`, body: null })),
    [],
  );

  target.state.failWhen = (call) =>
    call.method === 'PATCH' &&
    call.path === '/items/articles' &&
    (call.body as TRow[]).length > 2
      ? tooLarge()
      : undefined;

  const run = startRun(request, connect);
  await complete(run);

  assert.equal(run.status, 'succeeded');
  assert.equal(run.units.find((unit) => unit.name === 'articles')?.written, 5);
  assert.deepEqual(
    target.rows('articles').map((row) => row.title),
    ['new 1', 'new 2', 'new 3', 'new 4', 'new 5'],
  );
});

test('a single row too large for the target says what to change', async () => {
  const { target, request, connect } = pair(
    [{ id: 7, title: 'huge', body: null }],
    [],
  );

  target.state.failWhen = (call) =>
    call.method === 'PATCH' && call.path === '/items/articles'
      ? tooLarge()
      : undefined;

  const run = startRun(request, connect);
  await complete(run);

  assert.match(
    run.units.find((unit) => unit.name === 'articles')?.error ?? '',
    /articles 7 is larger .* MAX_PAYLOAD_SIZE/,
  );
});
