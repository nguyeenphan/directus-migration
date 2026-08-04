import type { TLocale } from '@/models/common';

export const ROUTES = {
  HOME: '/',
  MIGRATE: '/migrate',
} as const;

export type TRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const route = (lang: TLocale, path: TRoute) =>
  path === ROUTES.HOME ? `/${lang}` : `/${lang}${path}`;
