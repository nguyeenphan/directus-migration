'use client';

import type { ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { useTranslate } from '@/hooks/useTranslate';
import { cn } from '@/utils/cn';

import { CollectionCounts, type TTotals } from './collectionCounts';

type TProps = {
  name: string;
  totals: TTotals;
  checked: boolean;
  disabled: boolean;
  dimmed: boolean;
  active: boolean;
  nested?: boolean;

  onToggle: (isSelected: boolean) => void;
  onInspect: () => void;
  children?: ReactNode;
};

export const CollectionRow = ({
  name,
  totals,
  checked,
  disabled,
  dimmed,
  active,
  nested,
  onToggle,
  onInspect,
  children,
}: TProps) => {
  const translate = useTranslate();
  const inertLabel = translate('data-delete-only-disabled');
  const label = disabled ? inertLabel : translate('data-select-one', { name });

  return (
    <div
      className={cn(
        'group flex items-center gap-1 px-2 hover:bg-accent/60',
        active && 'bg-accent',
        dimmed && 'opacity-40',
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={label}
        title={disabled ? inertLabel : undefined}
        className="opacity-0 transition-none group-hover:opacity-100 data-checked:opacity-100 disabled:opacity-100"
      />

      {children ?? <span className="w-3.5" />}
      {nested && <span className="w-3.5" />}

      <button
        type="button"
        onClick={onInspect}
        className={cn(
          'identifier min-w-0 flex-1 truncate text-left hover:underline',
          nested && 'pl-4 text-xs text-muted-foreground hover:text-foreground',
        )}
        title={name}
      >
        {name}
      </button>

      <CollectionCounts totals={totals} />
    </div>
  );
};
