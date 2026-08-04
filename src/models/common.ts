import { SUPPORTED_LANGUAGES } from '@/constants/locales';

export type TLocale = (typeof SUPPORTED_LANGUAGES)[number];

export const isLocale = (value: string): value is TLocale =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

export type TResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type TRow = Record<string, unknown>;
