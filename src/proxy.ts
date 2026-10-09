import { type NextRequest, NextResponse } from 'next/server';

import { DEFAULT_LOCALE, SUPPORTED_LANGUAGES } from '@/constants/locales';
import { isLocale, type TLocale } from '@/models/common';

function pickLocale(header: string | null): TLocale {
  if (!header) return DEFAULT_LOCALE as TLocale;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag.toLowerCase(), q: q ? Number(q.split('=')[1]) : 1 };
    })
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE as TLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = SUPPORTED_LANGUAGES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const locale = pickLocale(request.headers.get('accept-language'));
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\.).*)'],
};
