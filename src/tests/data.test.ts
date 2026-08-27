import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprint } from '@/lib/directus/data';
import { isMissingCollection } from '@/lib/directus/errors';

const SOURCE_ROW = {
  id: 'abc',
  label: 'Full name',
  sort: 3,
  user_created: null,
  date_created: '2026-05-30T07:54:11.699Z',
  user_updated: null,
  date_updated: null,
};

const TARGET_ROW = {
  id: 'abc',
  label: 'Full name',
  sort: 3,
  user_created: '67e1b61d-74c2-4876-b140-2058eee8e34b',
  date_created: '2026-05-30T07:54:11.699Z',
  user_updated: '67e1b61d-74c2-4876-b140-2058eee8e34b',
  date_updated: '2026-08-03T07:25:23.533Z',
};

test('a migrated row matches its source despite the audit stamps', () => {
  assert.equal(fingerprint(SOURCE_ROW), fingerprint(TARGET_ROW));
});

test('a real content change still shows up', () => {
  assert.notEqual(
    fingerprint(SOURCE_ROW),
    fingerprint({ ...TARGET_ROW, label: 'Surname' }),
  );
});

test('key order does not matter', () => {
  assert.equal(
    fingerprint({ id: 1, a: 'x', b: 'y' }),
    fingerprint({ b: 'y', id: 1, a: 'x' }),
  );
});

test('null and undefined read as the same absence', () => {
  assert.equal(
    fingerprint({ id: 1, note: null }),
    fingerprint({ id: 1, note: undefined }),
  );
});

test('an empty value reads the same however it is spelled', () => {
  assert.equal(
    fingerprint({ id: 1, note: null }),
    fingerprint({ id: 1, note: '' }),
  );
});

test('line endings do not make a record look changed', () => {
  assert.equal(
    fingerprint({ id: 1, body: '<p>a</p>\r\n<p>b</p>' }),
    fingerprint({ id: 1, body: '<p>a</p>\n<p>b</p>' }),
  );
});

test('a database that reorders object keys does not invent a change', () => {
  assert.equal(
    fingerprint({ id: 1, faq: [{ q: 'a', answer: 'b' }] }),
    fingerprint({ id: 1, faq: [{ answer: 'b', q: 'a' }] }),
  );
});

test('characters the eye cannot see do not count as a change', () => {
  assert.equal(
    fingerprint({ id: 1, body: '\u00a0a\u200b' }),
    fingerprint({ id: 1, body: ' a' }),
  );
});

test('a number and its text read the same', () => {
  assert.equal(
    fingerprint({ id: 1, price: 10 }),
    fingerprint({ id: 1, price: '10' }),
  );

  assert.notEqual(
    fingerprint({ id: 1, price: 10 }),
    fingerprint({ id: 1, price: '10.00' }),
  );
});

test('real text changes still register', () => {
  assert.notEqual(
    fingerprint({ id: 1, body: 'a b' }),
    fingerprint({ id: 1, body: 'a  b' }),
  );

  assert.notEqual(
    fingerprint({ id: 1, body: 'a' }),
    fingerprint({ id: 1, body: 'A' }),
  );
});

test('a collection the target does not expose reads as missing', () => {
  assert.equal(
    isMissingCollection({
      errors: [
        {
          message:
            'You don\'t have permission to access collection "autoLoanGeneralInfo" or it does not exist.',
          extensions: { code: 'FORBIDDEN' },
        },
      ],
      response: { status: 403 },
    }),
    true,
  );
});

test('other failures still blow up the plan', () => {
  assert.equal(isMissingCollection(new Error('TIMEOUT')), false);
  assert.equal(
    isMissingCollection({
      errors: [{ extensions: { code: 'INVALID_CREDENTIALS' } }],
      response: { status: 401 },
    }),
    false,
  );
});
