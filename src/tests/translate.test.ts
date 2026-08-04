import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTranslate } from '@/utils/translate';

import en from '../../public/locales/en.json';
import vi from '../../public/locales/vi.json';

const translate = createTranslate(en);

test('interpolates {{variable}} placeholders', () => {
  assert.equal(
    translate('apply-confirm-title', { target: 'production' }),
    'Write to production',
  );
});

test('picks the plural form from count', () => {
  assert.equal(
    translate('schema-destructive-count', { count: 1 }),
    '1 destructive change',
  );
  assert.equal(
    translate('schema-destructive-count', { count: 4 }),
    '4 destructive changes',
  );
});

test('falls back to _other when a language has no singular form', () => {
  const translateVi = createTranslate(vi);
  assert.equal(
    translateVi('schema-destructive-count', { count: 1 }),
    '1 thay đổi phá huỷ dữ liệu',
  );
});

test('a missing key renders as the key, never as a blank', () => {
  const empty = createTranslate({});
  assert.equal(empty('apply-run'), 'apply-run');
});

test('vi covers every en key, allowing for its lack of a singular form', () => {
  const viKeys = new Set(Object.keys(vi));

  const missing = Object.keys(en).filter((key) => {
    if (viKeys.has(key)) return false;

    return !(
      key.endsWith('_one') && viKeys.has(key.replace(/_one$/, '_other'))
    );
  });

  assert.deepEqual(missing, []);
});

test('every placeholder in en also appears in the vi string', () => {
  const placeholders = (value: string) =>
    [...value.matchAll(/\{\{(\w+)\}\}/g)].map(([, name]) => name).sort();

  const dictionaryVi: Record<string, string> = vi;

  const mismatched = Object.entries(en)
    .filter(([key]) => key in dictionaryVi)
    .filter(
      ([key, value]) =>
        placeholders(value).join() !== placeholders(dictionaryVi[key]).join(),
    )
    .map(([key]) => key);

  assert.deepEqual(mismatched, []);
});
