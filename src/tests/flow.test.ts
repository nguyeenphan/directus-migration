import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprintOf } from '@/models/connection';
import { blockedSteps, type TFlowState } from '@/models/flow';

const ready: TFlowState = {
  canLeaveConnect: true,
  hasPlan: true,
  planFor: 'a',
  fingerprint: 'a',
  runInProgress: false,
  hasDataSelected: true,
  sequencesPending: false,
  sequencesConfirmed: false,
};

test('a ready flow blocks nothing', () => {
  assert.deepEqual(blockedSteps(ready), {});
});

test('an unprobed connection closes every review step', () => {
  const blocked = blockedSteps({ ...ready, canLeaveConnect: false });

  assert.equal(blocked.schema, 'blocked-connect-incomplete');
  assert.equal(blocked.data, 'blocked-connect-incomplete');
  assert.equal(blocked.apply, 'blocked-connect-incomplete');
});

test('a plan built for another connection is stale', () => {
  const blocked = blockedSteps({ ...ready, fingerprint: 'b' });

  assert.equal(blocked.apply, 'blocked-plan-stale');
});

test('an empty selection closes apply but leaves data open', () => {
  const blocked = blockedSteps({ ...ready, hasDataSelected: false });

  assert.equal(blocked.apply, 'blocked-nothing-selected');
  assert.equal(blocked.data, undefined);
});

test('an unconfirmed sequence script only closes apply', () => {
  const blocked = blockedSteps({ ...ready, sequencesPending: true });

  assert.equal(blocked.apply, 'blocked-sequences-unconfirmed');
  assert.equal(blocked.data, undefined);
});

test('a run in progress pins the user to the run', () => {
  const blocked = blockedSteps({ ...ready, runInProgress: true });

  assert.equal(blocked.connect, 'blocked-run-in-progress');
  assert.equal(blocked.apply, 'blocked-run-in-progress');
});

test('a run in progress outranks a stale plan', () => {
  const blocked = blockedSteps({
    ...ready,
    runInProgress: true,
    fingerprint: 'b',
  });

  assert.equal(blocked.connect, 'blocked-run-in-progress');
});

test('changing either end changes the fingerprint', () => {
  const source = { url: 'https://a.test', token: '1' };
  const target = { url: 'https://b.test', token: '2' };

  assert.notEqual(
    fingerprintOf(source, target),
    fingerprintOf(source, { ...target, token: '3' }),
  );
  assert.equal(fingerprintOf(source, target), fingerprintOf(source, target));
});
