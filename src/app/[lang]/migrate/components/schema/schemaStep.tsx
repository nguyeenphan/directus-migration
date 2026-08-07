'use client';

import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useTranslate } from '@/hooks/useTranslate';
import {
  destructiveChanges,
  strandedBy,
  type TSchemaPlan,
} from '@/models/plan';

import { RecompareButton } from '../recompareButton';
import { SchemaDetail } from './detail/schemaDetail';
import { SchemaTree } from './tree/schemaTree';

type TProps = {
  plan: TSchemaPlan;
  selection: Set<string>;
  applySchema: boolean;
  isApplyingSchema: boolean;
  schemaRunError: string | null;
  onApplySchemaChange: (apply: boolean) => void;
  onSelectionChange: (selection: Set<string>) => void;
  onApplySchemaNow: () => void;
  isRecomparing: boolean;
  onRecompare: () => void;
  onContinue: () => void;
};

export const SchemaStep = ({
  plan,
  selection,
  applySchema,
  isApplyingSchema,
  schemaRunError,
  onApplySchemaChange,
  onSelectionChange,
  onApplySchemaNow,
  isRecomparing,
  onRecompare,
  onContinue,
}: TProps) => {
  const translate = useTranslate();
  const [active, setActive] = useState<string | null>(
    plan.collections[0]?.collection ?? null,
  );

  const entry = plan.collections.find((item) => item.collection === active);

  const destructive = useMemo(() => destructiveChanges(plan), [plan]);
  const stranded = useMemo(
    () => strandedBy(plan, selection),
    [plan, selection],
  );

  const toggle = (collection: string, isSelected: boolean) => {
    const next = new Set(selection);
    if (isSelected) next.add(collection);
    else next.delete(collection);
    onSelectionChange(next);
  };

  if (plan.collections.length === 0 && plan.relations.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
        <div className="grid flex-1 place-items-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Check className="size-8 text-success" strokeWidth={1.5} />
            <p className="text-xl font-semibold tracking-tight">
              {translate('schema-in-sync-title')}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {translate('schema-in-sync-detail')}
            </p>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t pt-3">
          <span className="ml-auto">
            <RecompareButton
              isRecomparing={isRecomparing}
              onRecompare={onRecompare}
            />
          </span>

          <Button size="lg" onClick={onContinue}>
            {translate('schema-skip-to-data')}
          </Button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{translate('schema-title')}</h1>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={applySchema}
            onCheckedChange={onApplySchemaChange}
          />
          {translate('schema-apply-toggle')}
        </label>
      </div>

      {stranded.length > 0 && (
        <div className="flex items-start gap-2 border border-warning p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {translate('schema-stranded-title', { count: stranded.length })}
            </p>
            <ul className="identifier text-xs">
              {stranded.slice(0, 5).map(({ missing, needed }) => (
                <li key={missing}>
                  {translate('schema-stranded-line', {
                    missing,
                    dependents: needed.slice(0, 4).join(', '),
                    count: needed.length,
                  })}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ResizablePanelGroup className="min-h-0 flex-1 gap-2">
        <ResizablePanel defaultSize={38} minSize={22}>
          <SchemaTree
            plan={plan}
            selection={selection}
            active={active}
            onToggle={toggle}
            onInspect={setActive}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={62} minSize={30}>
          <SchemaDetail entry={entry ?? null} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <footer className="flex flex-wrap items-center gap-4 border-t pt-3 text-sm">
        <span className="identifier">
          {translate('schema-selected', {
            selected: selection.size,
            total: plan.collections.length,
          })}
        </span>
        {destructive.length > 0 && (
          <span className="identifier font-bold text-destructive">
            {translate('schema-destructive-count', {
              count: destructive.length,
            })}
          </span>
        )}
        {schemaRunError && (
          <span className="identifier text-destructive">{schemaRunError}</span>
        )}

        <span className="ml-auto">
          <RecompareButton
            isRecomparing={isRecomparing}
            onRecompare={onRecompare}
          />
        </span>

        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          disabled={!applySchema || isApplyingSchema}
          onClick={onApplySchemaNow}
        >
          {isApplyingSchema && <Loader2 className="size-4 animate-spin" />}
          {translate('schema-apply-now')}
        </Button>

        <Button size="lg" onClick={onContinue}>
          {translate('schema-continue')}
        </Button>
      </footer>
    </div>
  );
};
