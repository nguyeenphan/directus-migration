'use client';

import { DiffMark } from '@/components/common/diffMark';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslate } from '@/hooks/useTranslate';
import type { TCollectionChange } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  entry: TCollectionChange;
  isSelected: boolean;
  isActive: boolean;
  onToggle: (collection: string, isSelected: boolean) => void;
  onInspect: (collection: string) => void;
};

export const SchemaCollectionRow = ({
  entry,
  isSelected,
  isActive,
  onToggle,
  onInspect,
}: TProps) => {
  const translate = useTranslate();
  const destructive = entry.fields.filter((field) => field.destructive).length;

  return (
    <li
      className={cn(
        'flex items-center gap-2 px-2 hover:bg-accent/60',
        isActive && 'bg-accent',
        !isSelected && 'opacity-40',
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(entry.collection, checked)}
        aria-label={translate('schema-select-one', { name: entry.collection })}
      />
      <DiffMark kind={entry.kind} label={translate(`change-${entry.kind}`)} />

      <button
        type="button"
        onClick={() => onInspect(entry.collection)}
        className="identifier flex-1 truncate text-left hover:underline"
        title={entry.collection}
      >
        {entry.collection}
      </button>

      {entry.fields.length > 0 && (
        <span className="identifier shrink-0 text-xs text-muted-foreground tabular-nums">
          {entry.fields.length}
        </span>
      )}
      {(destructive > 0 || entry.kind === 'delete') && (
        <span
          title={translate('schema-destructive-hint')}
          className="shrink-0 font-bold text-destructive"
        >
          !
        </span>
      )}
    </li>
  );
};
