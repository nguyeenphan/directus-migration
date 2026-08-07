'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { useTranslate } from '@/hooks/useTranslate';

type TProps = {
  value: string;
  onChange: (value: string) => void;
};

export const CollectionSearchBar = ({ value, onChange }: TProps) => {
  const translate = useTranslate();

  return (
    <header className="border-b p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={translate('data-search')}
          aria-label={translate('data-search')}
          className="identifier h-8 pl-7"
        />
      </div>
    </header>
  );
};
