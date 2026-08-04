import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprintOf, parseConnection } from '@/models/connection';

const at = (url: string) => ({ url, token: 'x' });

test('a trailing slash never survives into the stored URL', () => {
  assert.equal(
    parseConnection({ url: 'https://a.test/api/', token: 't' }).url,
    'https://a.test/api',
  );
  assert.equal(
    parseConnection({ url: 'https://a.test/', token: 't' }).url,
    'https://a.test',
  );
});

test('the fingerprint changes when either end changes', () => {
  const source = at('https://a.test');
  const target = at('https://b.test');

  assert.equal(fingerprintOf(source, target), fingerprintOf(source, target));
  assert.notEqual(
    fingerprintOf(source, target),
    fingerprintOf(source, { ...target, token: 'y' }),
  );
});
