'use client';

import { TriangleAlert } from 'lucide-react';
import { Fragment } from 'react';

import { DiffMark } from '@/components/common/diffMark';
import { CHANGE_ROW, NOTHING } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TFieldChange } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  field: TFieldChange;
};

export const SchemaFieldRow = ({ field }: TProps) => {
  const translate = useTranslate();

  return (
    <li
      className={cn(
        'border-b px-3 py-1 last:border-b-0',
        CHANGE_ROW[field.kind],
      )}
    >
      <div className="flex items-center gap-2">
        <DiffMark kind={field.kind} label={translate(`change-${field.kind}`)} />
        <span className="identifier truncate font-medium">{field.field}</span>
      </div>

      {field.kind === 'modify' && field.targetType !== field.sourceType && (
        <dl className="ml-5 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt className="text-muted-foreground">{translate('value-target')}</dt>
          <dd className="identifier">{field.targetType ?? NOTHING}</dd>
          <dt className="text-muted-foreground">{translate('value-source')}</dt>
          <dd className="identifier font-medium">
            {field.sourceType ?? NOTHING}
          </dd>
        </dl>
      )}

      {field.kind === 'modify' && (
        <dl className="ml-5 grid grid-cols-2 gap-x-2 text-xs">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2">
            {field.attributes.map((attribute) => (
              <Fragment key={attribute.path}>
                <dt className="identifier text-muted-foreground">
                  {attribute.path}
                </dt>
                <dd
                  className="identifier truncate"
                  title={attribute.before ?? undefined}
                >
                  {attribute.before ?? NOTHING}
                </dd>
              </Fragment>
            ))}
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2">
            {field.attributes.map((attribute) => (
              <Fragment key={attribute.path}>
                <dt className="text-muted-foreground" aria-hidden>
                  →
                </dt>
                <dd
                  className="identifier truncate font-medium"
                  title={attribute.after ?? undefined}
                >
                  {attribute.after ?? NOTHING}
                </dd>
              </Fragment>
            ))}
          </div>
        </dl>
      )}

      {field.kind === 'modify' &&
        field.attributes.length === 0 &&
        field.targetType === field.sourceType && (
          <p className="ml-5 text-xs text-muted-foreground">
            {translate('schema-field-metadata-only')}
          </p>
        )}

      {field.kind !== 'modify' && (
        <p className="identifier ml-5 text-xs text-muted-foreground">
          {field.kind === 'add' ? field.sourceType : field.targetType}
        </p>
      )}

      {field.destructive && (
        <p className="ml-5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" />
          {translate('schema-may-lose-data')}
        </p>
      )}
    </li>
  );
};
