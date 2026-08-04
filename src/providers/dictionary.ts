import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { TLocale } from '@/models/common';
import type { TDictionary } from '@/utils/translate';

const dictionaryPath = (locale: TLocale) =>
  path.join(process.cwd(), 'public', 'locales', `${locale}.json`);

const cache = new Map<TLocale, TDictionary>();

export const getDictionary = async (locale: TLocale): Promise<TDictionary> => {
  const cached = cache.get(locale);
  if (cached && process.env.NODE_ENV === 'production') return cached;

  const contents = await readFile(dictionaryPath(locale), 'utf8');
  const dictionary = JSON.parse(contents) as TDictionary;

  cache.set(locale, dictionary);
  return dictionary;
};
