'use client';

import { useState } from 'react';

import { DiffMark } from '@/components/diffMark';
import { Button } from '@/components/ui/button';
import { CHANGE_ROW } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection } from '@/models/connection';
import type { TFieldValue, TRecordChange } from '@/models/plan';
import { cn } from '@/utils/cn';

import { FieldValueDialog } from './fieldValueDialog';
import { ValuePair } from './valuePair';

type TProps = {
  record: TRecordChange | null;
  position: { index: number; total: number };
  source: TConnection;
  target: TConnection;
  onNavigate: (delta: number) => void;
};

export const RecordDetail = ({
  record,
  position,
  source,
  target,
  onNavigate,
}: TProps) => {
  const translate = useTranslate();
  const [showAudit, setShowAudit] = useState(false);
  const [openField, setOpenField] = useState<TFieldValue | null>(null);

  if (!record) {
    return (
      <div className="flex h-full items-center justify-center border p-6 text-sm text-muted-foreground">
        {translate('data-pick-a-record')}
      </div>
    );
  }

  const audit = record.fields.filter((field) => field.audit);
  const visible = record.fields.filter((field) => showAudit || !field.audit);

  return (
    <div className="flex h-full min-h-0 flex-col border">
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

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[10rem_1fr] gap-x-4 border-b px-4 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>{translate('data-field')}</span>
          <div className="grid grid-cols-2 gap-3">
            <span>{translate('value-target')}</span>
            <span>{translate('value-source')}</span>
          </div>
        </div>

        <ul>
          {visible.map((field) => (
            <li
              key={field.field}
              onDoubleClick={() => setOpenField(field)}
              title={translate('data-open-value')}
              className={cn(
                'grid cursor-pointer grid-cols-[10rem_1fr] items-start gap-x-4 px-4 py-1',
                CHANGE_ROW[field.kind],
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                {field.kind === 'modify' ? (
                  <DiffMark kind="modify" label={translate('change-modify')} />
                ) : (
                  <span className="w-3" />
                )}
                <span
                  className={cn(
                    'identifier truncate',
                    field.kind === 'modify'
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50',
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
          ))}
        </ul>

        {audit.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAudit((current) => !current)}
            className="w-full px-4 py-1 text-left text-xs text-muted-foreground/70 hover:text-foreground"
          >
            {translate(showAudit ? 'data-hide-audit' : 'data-show-audit', {
              count: audit.length,
            })}
          </button>
        )}
      </div>

      <FieldValueDialog
        field={openField}
        onOpenChange={(open) => {
          if (!open) setOpenField(null);
        }}
      />

      <footer className="flex items-center justify-center gap-4 border-t px-4 py-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          disabled={position.index <= 0}
          onClick={() => onNavigate(-1)}
        >
          ‹ {translate('data-previous')}
        </Button>
        <span className="identifier tabular-nums text-muted-foreground">
          {position.index + 1} / {position.total}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={position.index >= position.total - 1}
          onClick={() => onNavigate(1)}
        >
          {translate('data-next')} ›
        </Button>
      </footer>
    </div>
  );
};
