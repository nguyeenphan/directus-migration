'use client';

import { useTranslate } from '@/hooks/useTranslate';

export const FieldTableHead = () => {
  const translate = useTranslate();

  return (
    <div className="grid grid-cols-[10rem_1fr] gap-x-4 border-b px-4 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
      <span>{translate('data-field')}</span>
      <div className="grid grid-cols-2 gap-3">
        <span>{translate('value-target')}</span>
        <span>{translate('value-source')}</span>
      </div>
    </div>
  );
};
