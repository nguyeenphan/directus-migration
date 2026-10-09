import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeError, describeErrorInDetail } from '@/utils/describeError';

test('a Directus error reads as its first message', () => {
  const error = {
    errors: [{ message: 'No', extensions: { code: 'FORBIDDEN', field: 'a' } }],
  };

  assert.equal(describeError(error), 'No');
  assert.equal(describeErrorInDetail(error), 'No | FORBIDDEN | field="a"');
});

test('a response the SDK could not parse does not blow up the description', () => {
  assert.equal(
    describeError({ errors: new SyntaxError('Unexpected end of JSON input') }),
    'Unexpected end of JSON input',
  );
  assert.equal(
    describeError({ errors: '<html>502</html>' }),
    '<html>502</html>',
  );
  assert.equal(describeErrorInDetail({ errors: {} }), '[object Object]');
});

test('a plain error reads as its message', () => {
  assert.equal(describeError(new Error('boom')), 'boom');
  assert.equal(describeError('text'), 'text');
});
