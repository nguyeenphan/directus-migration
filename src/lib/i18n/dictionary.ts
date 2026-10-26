import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';

import type { TDictionary } from '@/lib/i18n/translate';
import type { TLocale } from '@/models/common';

const dictionaryPath = (locale: TLocale) =>
  path.join(process.cwd(), 'public', 'locales', `${locale}.json`);

const held = new Map<TLocale, TDictionary>();

/**
 * `cache` dedupes within one request: the layout's `generateMetadata` and the
 * page both ask for the same locale. The Map holds it across requests in
 * production, while development re-reads so an edit to the JSON shows up.
 */
export const getDictionary = cache(
  async (locale: TLocale): Promise<TDictionary> => {
    const cached = held.get(locale);
    if (cached && process.env.NODE_ENV === 'production') return cached;

    const contents = await readFile(dictionaryPath(locale), 'utf8');
    const dictionary = JSON.parse(contents) as TDictionary;

    held.set(locale, dictionary);
    return dictionary;
  },
);
