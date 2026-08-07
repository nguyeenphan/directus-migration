'use client';

import { useMemo, useState } from 'react';

import { DiffMark } from '@/components/common/diffMark';
import { CHANGE_ROW } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import { changedFields, isAuditOnly, type TRecordChange } from '@/models/plan';
import { cn } from '@/utils/cn';
import type { TTranslate } from '@/utils/translate';

type TProps = {
  records: TRecordChange[];
  activeKey: string | null;
  onSelect: (key: string) => void;
};

export const RecordList = ({ records, activeKey, onSelect }: TProps) => {
  const translate = useTranslate();
  const [showAuditOnly, setShowAuditOnly] = useState(false);

  const { interesting, auditOnly } = useMemo(() => {
    const auditOnly = records.filter(isAuditOnly);
    const noise = new Set(auditOnly);

    return {
      interesting: records.filter((record) => !noise.has(record)),
      auditOnly,
    };
  }, [records]);

  const visible = showAuditOnly ? [...interesting, ...auditOnly] : interesting;

  return (
    <div className="flex h-full min-h-0 flex-col border">
      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <ul>
          {visible.map((record) => (
            <li key={`${record.kind}-${record.key}`}>
              <button
                type="button"
                onClick={() => onSelect(record.key)}
                className={cn(
                  'flex w-full items-baseline gap-2 px-2 text-left hover:bg-accent/60',
                  CHANGE_ROW[record.kind],
                  activeKey === record.key && 'bg-accent',
                )}
              >
                <DiffMark
                  kind={record.kind}
                  label={translate(`change-${record.kind}`)}
                />
                <span className="min-w-0 flex-1 truncate">{record.label}</span>
                <span className="identifier max-w-[45%] truncate text-right text-xs text-muted-foreground">
                  {summarise(record, translate)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            {translate('data-no-records')}
          </p>
        )}
      </div>

      {auditOnly.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAuditOnly((current) => !current)}
          className="border-t px-2 py-1.5 text-left text-xs text-muted-foreground/80 hover:text-foreground"
        >
          {translate(
            showAuditOnly
              ? 'data-hide-audit-records'
              : 'data-show-audit-records',
            { count: auditOnly.length },
          )}
        </button>
      )}
    </div>
  );
};

const summarise = (record: TRecordChange, translate: TTranslate) => {
  if (record.kind === 'add') return translate('data-new-record');
  if (record.kind === 'delete') return translate('data-will-be-deleted');

  const fields = changedFields(record);
  return fields.length > 0 ? fields.join(', ') : translate('data-audit-only');
};
