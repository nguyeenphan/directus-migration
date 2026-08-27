'use client';

import { CHANGE_BORDER } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TChangeKind, TFieldValue } from '@/models/plan';
import { cn } from '@/utils/cn';

import { ValuePair } from '../value/valuePair';

type TProps = {
  field: TFieldValue;
  recordKind: TChangeKind;
  onOpen: () => void;
};

export const FieldRow = ({ field, recordKind, onOpen }: TProps) => {
  const translate = useTranslate();
  const isModified = field.kind === 'modify';

  return (
    <li
      onDoubleClick={onOpen}
      title={translate('data-open-value')}
      className={cn(
        'flex cursor-pointer flex-col gap-0.5 border-l-2 py-1.5 pr-4 pl-3',
        isModified
          ? (CHANGE_BORDER[recordKind] ?? CHANGE_BORDER.modify)
          : 'border-transparent',
      )}
    >
      <span
        className="identifier truncate text-muted-foreground"
        title={field.field}
      >
        {field.field}
      </span>

      <ValuePair field={field} />
    </li>
  );
};
