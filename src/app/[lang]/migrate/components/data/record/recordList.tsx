'use client';

import { useMemo, useState } from 'react';

import { DiffMark } from '@/components/common/diffMark';
import { Checkbox } from '@/components/ui/checkbox';
import { CHANGE_ROW } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TTranslate } from '@/lib/i18n/translate';
import { changedFields, isAuditOnly, type TRecordChange } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  records: TRecordChange[];
  activeKey: string | null;

  // Keys the user unticked; everything else in the collection travels.
  excluded: ReadonlySet<string>;

  isTruncated: boolean;
  onSelect: (key: string) => void;
  onPick: (keys: string[], isPicked: boolean) => void;
};

export const RecordList = ({
  records,
  activeKey,
  excluded,
  isTruncated,
  onSelect,
  onPick,
}: TProps) => {
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
  const isPicked = (key: string) => !excluded.has(key);
  const pickedCount = visible.filter((record) => isPicked(record.key)).length;
  const allPicked = pickedCount === visible.length;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-base border-2 bg-secondary-background">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Checkbox
          checked={allPicked}
          onCheckedChange={(checked) =>
            onPick(
              records.map((record) => record.key),
              Boolean(checked),
            )
          }
          aria-label={translate('data-pick-all-records')}
        />
        <span className="text-xs text-muted-foreground">
          {excluded.size === 0
            ? translate('data-pick-all-records')
            : translate('data-excluded-records', { count: excluded.size })}
        </span>

        <span className="identifier ml-auto text-xs tabular-nums text-muted-foreground">
          {pickedCount} / {visible.length}
        </span>
      </div>

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <ul>
          {visible.map((record) => (
            <li key={`${record.kind}-${record.key}`}>
              <div
                className={cn(
                  'flex items-baseline gap-2 px-2 hover:bg-muted',
                  CHANGE_ROW[record.kind],
                  activeKey === record.key && 'bg-muted',
                  !isPicked(record.key) && 'opacity-40',
                )}
              >
                <Checkbox
                  checked={isPicked(record.key)}
                  onCheckedChange={(checked) =>
                    onPick([record.key], Boolean(checked))
                  }
                  aria-label={translate('data-pick-record', {
                    name: record.label,
                  })}
                  className="self-center"
                />

                <button
                  type="button"
                  onClick={() => onSelect(record.key)}
                  className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                >
                  <DiffMark
                    kind={record.kind}
                    label={translate(`change-${record.kind}`)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {record.label}
                  </span>
                  <span className="identifier max-w-[45%] truncate text-right text-xs text-muted-foreground">
                    {summarise(record, translate)}
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            {translate('data-no-records')}
          </p>
        )}
      </div>

      {isTruncated && (
        <p className="border-t px-2 py-1.5 text-xs text-warning">
          {translate('data-records-truncated', { count: records.length })}
        </p>
      )}

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
