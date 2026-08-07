'use client';

import { DiffMark } from '@/components/common/diffMark';
import { useTranslate } from '@/hooks/useTranslate';
import type { TRecordChange } from '@/models/plan';

type TProps = {
  record: TRecordChange;
};

export const RecordHeader = ({ record }: TProps) => {
  const translate = useTranslate();

  return (
    <header className="flex flex-col gap-1 border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <DiffMark
          kind={record.kind}
          label={translate(`change-${record.kind}`)}
        />
        <h2 className="truncate text-base font-semibold">{record.label}</h2>
      </div>
      <p className="identifier text-xs text-muted-foreground">
        id {record.key}
      </p>
      {record.kind === 'conflict' && (
        <p className="text-xs text-muted-foreground">
          {translate('data-conflict-note')}
        </p>
      )}
    </header>
  );
};
