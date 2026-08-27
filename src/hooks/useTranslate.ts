'use client';

import { useTranslation } from '@/contexts/translationContext';

export const useTranslate = () => useTranslation().translate;
