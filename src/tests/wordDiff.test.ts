import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  collapseUnchanged,
  type TDiffOp,
  toDiffLines,
  wordDiff,
} from '@/utils/wordDiff';

const render = (ops: TDiffOp[]) =>
  ops.map((op) => `${op.type}:${op.text}`).join('|');

test('identical text produces one untouched run', () => {
  assert.equal(render(wordDiff('a b c', 'a b c')), 'same:a b c');
});

test('a single changed word leaves the rest of the sentence alone', () => {
  const ops = wordDiff('Vay mua nha', 'Vay mua xe');

  assert.equal(render(ops), 'same:Vay mua |del:nha|add:xe');
});

test('rejoining a diff reproduces both sides exactly', () => {
  const before = 'the  quick\nbrown fox';
  const after = 'the quick\nred fox jumps';
  const ops = wordDiff(before, after);

  const left = ops
    .filter((op) => op.type !== 'add')
    .map((op) => op.text)
    .join('');
  const right = ops
    .filter((op) => op.type !== 'del')
    .map((op) => op.text)
    .join('');

  assert.equal(left, before);
  assert.equal(right, after);
});

test('insertion into empty and deletion to empty are one-sided', () => {
  assert.equal(render(wordDiff('', 'hello')), 'add:hello');
  assert.equal(render(wordDiff('hello', '')), 'del:hello');
  assert.deepEqual(wordDiff('', ''), []);
});

test('lines carry a changed flag drawn from their own ops', () => {
  const lines = toDiffLines(wordDiff('a\nb\nc', 'a\nB\nc'));

  assert.deepEqual(
    lines.map((line) => line.changed),
    [false, true, false],
  );
});

test('long untouched stretches fold, keeping context either side', () => {
  const before = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
  const after = before.replace('line 15', 'line fifteen');

  const blocks = collapseUnchanged(toDiffLines(wordDiff(before, after)));

  assert.deepEqual(
    blocks.map((block) => block.type),
    ['gap', 'lines', 'gap'],
  );
  assert.equal(blocks[1].lines.length, 5);
  assert.ok(blocks[1].lines.some((line) => line.changed));
});

test('a gap no longer than the context is shown rather than folded', () => {
  const blocks = collapseUnchanged(toDiffLines(wordDiff('a\nb', 'A\nB')));

  assert.deepEqual(
    blocks.map((block) => block.type),
    ['lines'],
  );
});

test('text over the token cap degrades to a whole-block replace', () => {
  const before = Array.from({ length: 4000 }, (_, i) => `w${i}`).join(' ');
  const after = `${before} extra`;

  assert.deepEqual(
    wordDiff(before, after).map((op) => op.type),
    ['del', 'add'],
  );
});
