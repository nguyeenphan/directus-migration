import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveUpstream, upstreamTarget } from '@/models/upstream';

const target = (url: string, path: string[], search = '') =>
  upstreamTarget(new URL(url), path, new URLSearchParams(search)).toString();

test('a plain origin gets the path appended', () => {
  assert.equal(
    target('https://cms.example.com', ['items', 'products']),
    'https://cms.example.com/items/products',
  );
});

test('an upstream under a sub-path keeps it as a prefix', () => {
  assert.equal(
    target('https://example.com/directus', ['schema', 'snapshot']),
    'https://example.com/directus/schema/snapshot',
  );
});

test('a trailing slash on the upstream does not double up', () => {
  assert.equal(
    target('https://example.com/directus/', ['fields']),
    'https://example.com/directus/fields',
  );
});

test('the query is carried over but the routing param is dropped', () => {
  assert.equal(
    target(
      'https://cms.example.com',
      ['assets', 'abc'],
      'width=96&_directus=https://x.dev',
    ),
    'https://cms.example.com/assets/abc?width=96',
  );
});

test('a missing or unusable URL is rejected, not guessed at', () => {
  assert.throws(() => resolveUpstream(null, []), /Missing upstream/);
  assert.throws(
    () => resolveUpstream('cms.example.com', []),
    /Not a valid URL/,
  );
  assert.throws(
    () => resolveUpstream('file:///etc/passwd', []),
    /Unsupported protocol/,
  );
});

test('the allowlist only applies once it has entries', () => {
  assert.equal(
    resolveUpstream('https://cms.example.com', []).host,
    'cms.example.com',
  );
  assert.equal(
    resolveUpstream('https://cms.example.com', ['cms.example.com']).host,
    'cms.example.com',
  );
  assert.throws(
    () => resolveUpstream('http://169.254.169.254', ['cms.example.com']),
    /Host not allowed/,
  );
});
