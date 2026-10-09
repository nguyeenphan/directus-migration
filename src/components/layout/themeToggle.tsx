'use client';

import { Contrast } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { THEME_STORAGE_KEY } from '@/constants/storage';
import { useTranslate } from '@/hooks/useTranslate';

// The class on <html> is the state: the inline script in the layout sets it
// before paint, and nothing here renders differently per theme.
const toggleTheme = () => {
  const isDark = document.documentElement.classList.toggle('dark');

  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch {
    // Storage can be unavailable (private mode, quota); the toggle still works.
  }
};

export const ThemeToggle = () => {
  const label = useTranslate()('header-toggle-theme');

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      <Contrast />
    </Button>
  );
};
