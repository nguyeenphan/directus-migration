'use client';

import { Contrast } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { THEME_STORAGE_KEY } from '@/constants/storage';
import { useTranslate } from '@/hooks/useTranslate';

export const ThemeToggle = () => {
  const translate = useTranslate();

  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const label = translate('header-toggle-theme');

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      onClick={() => setIsDark((current) => !current)}
    >
      <Contrast />
    </Button>
  );
};
