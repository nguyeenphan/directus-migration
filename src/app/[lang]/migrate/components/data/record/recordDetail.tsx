'use client';

import { Fragment, useState } from 'react';

import { NOTHING } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TFieldValue, TRecordChange } from '@/models/plan';

import { FieldValueDialog } from '../value/fieldValueDialog';
import { FieldRow } from './fieldRow';
import { RecordHeader } from './recordHeader';
import { RecordNav } from './recordNav';

type TProps = {
  record: TRecordChange | null;
  position: { index: number; total: number };
  onNavigate: (delta: number) => void;
};

const FieldGroup = ({
  label,
  fields,
  withValues = false,
}: {
  label: string;
  fields: TFieldValue[];
  withValues?: boolean;
}) =>
  fields.length === 0 ? null : (
    <details className="group border-t">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="inline-block w-3 transition-transform group-open:rotate-90">
          ›
        </span>
        {label}
      </summary>

      {withValues ? (
        <dl className="grid grid-cols-[12rem_1fr] gap-x-3 px-3 pb-2 pl-8 text-muted-foreground">
          {fields.map((field) => (
            <Fragment key={field.field}>
              <dt className="identifier truncate" title={field.field}>
                {field.field}
              </dt>
              <dd className="identifier truncate opacity-70">
                {field.before ?? field.after ?? NOTHING}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className="identifier px-3 pb-2 pl-8 text-muted-foreground opacity-70">
          {fields.map((field) => field.field).join(', ')}
        </p>
      )}
    </details>
  );

export const RecordDetail = ({ record, position, onNavigate }: TProps) => {
  const translate = useTranslate();
  const [showAudit, setShowAudit] = useState(false);
  const [openField, setOpenField] = useState<TFieldValue | null>(null);

  if (!record) {
    return (
      <div className="flex h-full items-center justify-center rounded-base border-2 bg-secondary-background p-6 text-sm text-muted-foreground">
        {translate('data-pick-a-record')}
      </div>
    );
  }

  const audit = record.fields.filter((field) => field.audit);
  const visible = record.fields.filter((field) => showAudit || !field.audit);

  const changed = visible.filter((field) => field.kind === 'modify');
  const untouched = visible.filter((field) => field.kind !== 'modify');

  const empty = untouched.filter(
    (field) => field.before === null && field.after === null,
  );
  const same = untouched.filter(
    (field) => field.before !== null || field.after !== null,
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-base border-2 bg-secondary-background">
      <RecordHeader record={record} />

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <ul>
          {changed.map((field) => (
            <FieldRow
              key={field.field}
              field={field}
              recordKind={record.kind}
              onOpen={() => setOpenField(field)}
            />
          ))}
        </ul>

        <FieldGroup
          withValues
          fields={same}
          label={translate('data-fields-unchanged', { count: same.length })}
        />

        <FieldGroup
          fields={empty}
          label={translate('data-fields-empty', { count: empty.length })}
        />

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
