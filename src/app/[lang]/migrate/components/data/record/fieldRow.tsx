'use client';

import { DiffMark } from '@/components/common/diffMark';
import { CHANGE_ROW } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection } from '@/models/connection';
import type { TFieldValue } from '@/models/plan';
import { cn } from '@/utils/cn';

import { ValuePair } from '../value/valuePair';

type TProps = {
  field: TFieldValue;
  source: TConnection;
  target: TConnection;
  onOpen: () => void;
};

export const FieldRow = ({ field, source, target, onOpen }: TProps) => {
  const translate = useTranslate();
  const isModified = field.kind === 'modify';

  return (
    <li
      onDoubleClick={onOpen}
      title={translate('data-open-value')}
      className={cn(
        'grid cursor-pointer grid-cols-[10rem_1fr] items-start gap-x-4 px-4 py-1',
        CHANGE_ROW[field.kind],
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        {isModified ? (
          <DiffMark kind="modify" label={translate('change-modify')} />
        ) : (
          <span className="w-3" />
        )}
        <span
          className={cn(
            'identifier truncate',
            isModified ? 'text-muted-foreground' : 'text-muted-foreground/50',
          )}
          title={field.field}
        >
          {field.field}
        </span>
      </span>

      <div className={field.kind === 'unchanged' ? 'opacity-45' : ''}>
        <ValuePair field={field} source={source} target={target} />
      </div>
    </li>
  );
};
