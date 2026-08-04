import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blankAudit, withoutAuditUsers } from '@/api/runner';

const ROW = {
  id: 7,
  name: 'partner',
  user_created: '256e1e54-09f9-4f5d-9b08-aebbd40c403c',
  date_created: '2025-01-02T03:04:05Z',
  user_updated: '256e1e54-09f9-4f5d-9b08-aebbd40c403c',
  date_updated: '2025-06-07T08:09:10Z',
};

test('all four audit columns go out as an explicit null', () => {
  assert.deepEqual(blankAudit(ROW), {
    id: 7,
    name: 'partner',
    user_created: null,
    date_created: null,
    user_updated: null,
    date_updated: null,
  });
});

test('a row missing the audit columns still gets them, as null', () => {
  assert.deepEqual(blankAudit({ id: 1 }), {
    id: 1,
    user_created: null,
    date_created: null,
    user_updated: null,
    date_updated: null,
  });
});

test('content is untouched', () => {
  assert.equal(blankAudit(ROW).name, 'partner');
  assert.equal(blankAudit(ROW).id, 7);
});

test('rollback drops the user columns and keeps the target dates', () => {
  const restored = withoutAuditUsers(ROW);

  assert.equal('user_created' in restored, false);
  assert.equal('user_updated' in restored, false);
  assert.equal(restored.date_created, '2025-01-02T03:04:05Z');
  assert.equal(restored.date_updated, '2025-06-07T08:09:10Z');
});
