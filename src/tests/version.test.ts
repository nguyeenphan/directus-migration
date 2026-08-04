import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareVersions, isDriftPassable } from '@/utils/version';

test('equal versions are the same', () => {
  assert.equal(compareVersions('11.17.1', '11.17.1'), 'same');
});

test('a patch gap is a patch gap, in either direction', () => {
  assert.equal(compareVersions('11.17.1', '11.17.3'), 'patch');
  assert.equal(compareVersions('11.17.3', '11.17.1'), 'patch');
});

test('a minor or major gap blocks', () => {
  assert.equal(compareVersions('11.17.1', '11.18.0'), 'major');
  assert.equal(compareVersions('11.17.1', '12.0.0'), 'major');
});

test('pre-release suffixes compare on the numeric part', () => {
  assert.equal(compareVersions('11.17.1-rc.2', '11.17.1'), 'same');
});

test('a version missing its patch part is not readable', () => {
  assert.equal(compareVersions('11.17', '11.17.1'), 'unknown');
});

test('an unreadable or absent version is never silently passed', () => {
  assert.equal(compareVersions(null, '11.17.1'), 'unknown');
  assert.equal(compareVersions('nightly', '11.17.1'), 'unknown');
  assert.equal(isDriftPassable('unknown'), false);
  assert.equal(isDriftPassable('major'), false);
  assert.equal(isDriftPassable('patch'), true);
  assert.equal(isDriftPassable('same'), true);
});
