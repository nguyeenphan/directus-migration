'use client';

import { createContext, use, useMemo } from 'react';

import type { TLocale } from '@/models/common';
import {
  createTranslate,
  type TDictionary,
  type TTranslate,
} from '@/utils/translate';

type TTranslationContext = {
  locale: TLocale;
  translate: TTranslate;
};

type TProps = {
  locale: TLocale;
  dictionary: TDictionary;
  children: React.ReactNode;
};

const TranslationContext = createContext<TTranslationContext | null>(null);

export const TranslationProvider = ({
  locale,
  dictionary,
  children,
}: TProps) => {
  const value = useMemo(
    () => ({ locale, translate: createTranslate(dictionary) }),
    [locale, dictionary],
  );

  return <TranslationContext value={value}>{children}</TranslationContext>;
};

export const useTranslation = () => {
  const context = use(TranslationContext);

  if (!context) {
    throw new Error('useTranslation must be used inside a TranslationProvider');
  }

  return context;
};
