import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprintOf } from '@/models/connection';
import { blockedSteps, type TFlowState } from '@/models/flow';

const ready: TFlowState = {
  canLeaveConnect: true,
  hasPlan: true,
  planFor: 'a',
  fingerprint: 'a',
  runOn: null,
  hasDataSelected: true,
  dependenciesMissing: false,
};

test('a ready flow blocks nothing', () => {
  assert.deepEqual(blockedSteps(ready), {});
});

test('a collection whose foreign keys point outside the selection blocks apply', () => {
  const blocked = blockedSteps({ ...ready, dependenciesMissing: true });

  assert.equal(blocked.apply, 'blocked-missing-dependencies');
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

test('a run in progress pins the user to the run', () => {
  const blocked = blockedSteps({ ...ready, runOn: 'schema' });

  assert.equal(blocked.connect, 'blocked-run-in-progress');
  assert.equal(blocked.apply, 'blocked-run-in-progress');
  assert.equal(blocked.schema, undefined);
});

test('a data run closes every step but the one showing it', () => {
  const blocked = blockedSteps({ ...ready, runOn: 'apply' });

  assert.equal(blocked.connect, 'blocked-run-in-progress');
  assert.equal(blocked.schema, 'blocked-run-in-progress');
  assert.equal(blocked.data, 'blocked-run-in-progress');
  assert.equal(blocked.apply, undefined);
});

test('a run in progress outranks a stale plan', () => {
  const blocked = blockedSteps({
    ...ready,
    runOn: 'schema',
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
