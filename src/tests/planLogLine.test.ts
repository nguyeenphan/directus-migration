import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePlanLogLine } from '@/utils/planLogLine';

const rejoin = (line: string) => {
  const { collection, text, counts } = parsePlanLogLine(line);
  return `${collection ?? ''}${text}${counts.map((count) => count.label).join(' ')}`;
};

test('splits the collection name and the change counts', () => {
  const line =
    'articles: read 40 from the source and 34 from the target — +10 ~? -0';
  const parsed = parsePlanLogLine(line);

  assert.equal(parsed.collection, 'articles');
  assert.deepEqual(
    parsed.counts.map(({ kind, label, isZero }) => [kind, label, isZero]),
    [
      ['add', '+10', false],
      ['modify', '~?', false],
      ['delete', '-0', true],
    ],
  );
  assert.equal(rejoin(line), line);
});

test('leaves lines without a collection or counts untouched', () => {
  for (const line of [
    'Diffing schemas',
    'Comparing Step (5/116)',
    'Target does not know 2 meta key(s) the source sends: status',
  ]) {
    assert.deepEqual(parsePlanLogLine(line), {
      collection: null,
      text: line,
      counts: [],
    });
  }

  const warning =
    'Step: the target has nothing to read — every record counts as new';
  assert.equal(parsePlanLogLine(warning).collection, 'Step');
  assert.equal(rejoin(warning), warning);
});
