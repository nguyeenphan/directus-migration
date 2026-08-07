'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { CHANGE_GLYPH } from '@/constants/changeStyles';
import { SCHEMA_FILTERS } from '@/constants/schema';
import { useTranslate } from '@/hooks/useTranslate';
import type { TSchemaFilter } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  query: string;
  filter: TSchemaFilter;
  onQueryChange: (value: string) => void;
  onFilterChange: (filter: TSchemaFilter) => void;
};

export const SchemaFilterBar = ({
  query,
  filter,
  onQueryChange,
  onFilterChange,
}: TProps) => {
  const translate = useTranslate();

  return (
    <header className="flex flex-col gap-2 border-b p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={translate('schema-search')}
          aria-label={translate('schema-search')}
          className="identifier h-8 pl-7"
        />
      </div>

      <div className="flex gap-1">
        {SCHEMA_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onFilterChange(option)}
            className={cn(
              'identifier border px-2 py-0.5 text-xs',
              filter === option
                ? 'border-foreground bg-accent font-semibold'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {option === 'all' ? translate('filter-all') : CHANGE_GLYPH[option]}
          </button>
        ))}
      </div>
    </header>
  );
};
