'use client';

import { useState } from 'react';

import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection } from '@/models/connection';
import type { TFieldValue, TRecordChange } from '@/models/plan';

import { FieldValueDialog } from '../value/fieldValueDialog';
import { FieldRow } from './fieldRow';
import { FieldTableHead } from './fieldTableHead';
import { RecordHeader } from './recordHeader';
import { RecordNav } from './recordNav';

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
      <RecordHeader record={record} />

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <FieldTableHead />

        <ul>
          {visible.map((field) => (
            <FieldRow
              key={field.field}
              field={field}
              source={source}
              target={target}
              onOpen={() => setOpenField(field)}
            />
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

      <RecordNav position={position} onNavigate={onNavigate} />
    </div>
  );
};
