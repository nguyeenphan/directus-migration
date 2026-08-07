'use client';

import { DiffMark } from '@/components/common/diffMark';
import { useTranslate } from '@/hooks/useTranslate';
import type { TCollectionChange } from '@/models/plan';

import { SchemaFieldRow } from './schemaFieldRow';

type TProps = {
  entry: TCollectionChange | null;
};

const GROUPS = ['add', 'modify', 'delete'] as const;

export const SchemaDetail = ({ entry }: TProps) => {
  const translate = useTranslate();

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center border p-6 text-sm text-muted-foreground">
        {translate('schema-pick-a-collection')}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col border">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <DiffMark kind={entry.kind} label={translate(`change-${entry.kind}`)} />
        <span className="identifier truncate font-medium">
          {entry.collection}
        </span>
        {entry.dependents.length > 0 && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {translate('schema-dependent-count', {
              count: entry.dependents.length,
            })}
          </span>
        )}
      </header>

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        {entry.fields.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            {translate('schema-collection-level-only')}
          </p>
        )}

        {GROUPS.map((kind) => {
          const fields = entry.fields.filter((field) => field.kind === kind);
          if (fields.length === 0) return null;

          return (
            <section key={kind}>
              <h3 className="border-b bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {translate(`schema-fields-${kind}`, { count: fields.length })}
              </h3>
              <ul>
                {fields.map((field) => (
                  <SchemaFieldRow key={field.field} field={field} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
};
