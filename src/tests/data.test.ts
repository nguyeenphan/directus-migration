import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprint, isMissingCollection } from '@/api/data';

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

test('a value change from null to empty string is still a change', () => {
  assert.notEqual(
    fingerprint({ id: 1, note: null }),
    fingerprint({ id: 1, note: '' }),
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
