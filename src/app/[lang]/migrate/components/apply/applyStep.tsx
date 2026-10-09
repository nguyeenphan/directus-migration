'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { TApplyRun } from '@/hooks/useApplyRun';
import { useDryRun } from '@/hooks/useDryRun';
import { useTranslate } from '@/hooks/useTranslate';
import { hostOf, type TConnection } from '@/models/connection';
import type { TPlan, TRecordExclusions } from '@/models/plan';

import { DryRunReport } from './dryRun/dryRunReport';
import { RunView } from './run/runView';
import { ApplyOrderStep } from './step/applyOrderStep';
import { ConfirmWriteDialog } from './step/confirmWriteDialog';
import { SummaryTile } from './step/summaryTile';

type TProps = {
  source: TConnection;
  target: TConnection;
  plan: TPlan;
  dataSelection: Set<string>;
  excluded: TRecordExclusions;
  mirrorData: boolean;
  applyRun: TApplyRun;
  isRecomparing: boolean;
  onRecompare: () => void;
  onBack: () => void;
};

export const ApplyStep = ({
  source,
  target,
  plan,
  dataSelection,
  excluded,
  mirrorData,
  applyRun,
  isRecomparing,
  onRecompare,
  onBack,
}: TProps) => {
  const translate = useTranslate();

  const [reviewed, setReviewed] = useState(false);

  const collections = [...dataSelection];
  const selected = plan.data.filter((row) => dataSelection.has(row.collection));

  // The most the run can write: unticked records only ever lower these.
  const counts = {
    records: selected.reduce(
      (total, row) => total + row.toCreate + (row.toUpdate ?? 0),
      0,
    ),
    deletes: mirrorData
      ? selected.reduce((total, row) => total + row.extraInTarget, 0)
      : 0,
  };

  const dryRun = useDryRun({
    source,
    target,
    collections,
    excluded,
    schemaChanges: plan.schema.collections.length,
  });

  const isBusy = dryRun.isRunning || applyRun.isStarting;
  const error = applyRun.error ?? dryRun.error;

  const confirmWrite = (
    <ConfirmWriteDialog
      open={applyRun.needsConfirmation}
      onOpenChange={applyRun.setNeedsConfirmation}
      onConfirm={applyRun.start}
    />
  );

  if (applyRun.run) {
    return (
      <>
        <RunView
          key={applyRun.run.id}
          run={applyRun.run}
          target={target}
          onRunChange={applyRun.setRun}
          onRetry={applyRun.apply}
          isRecomparing={isRecomparing}
          onRecompare={onRecompare}
        />

        {applyRun.error && (
          <pre className="identifier rounded-base border-2 border-destructive bg-secondary-background p-3 text-sm text-destructive">
            {applyRun.error}
          </pre>
        )}

        {confirmWrite}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 -mr-1 overflow-y-auto pr-1 pb-1">
      <h1 className="text-xl font-heading">{translate('apply-title')}</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label={translate('apply-tile-records')}
          value={counts.records}
        />
        <SummaryTile
          label={translate('apply-tile-collections')}
          value={collections.length}
        />
        <SummaryTile
          label={translate('apply-tile-deletes')}
          value={counts.deletes}
          tone="danger"
        />
      </section>

      <section className="rounded-base border-2 bg-secondary-background p-4">
        <h2 className="mb-2 text-xs font-heading uppercase tracking-wide text-muted-foreground">
          {translate('apply-order-title')}
        </h2>
        <ol className="diff-dense">
          <ApplyOrderStep
            index={1}
            label={translate('apply-order-backup')}
            detail={translate('apply-order-backup-detail')}
          />
          <ApplyOrderStep
            index={2}
            label={translate('apply-order-files')}
            detail={translate('apply-order-files-detail')}
          />
          <ApplyOrderStep
            index={3}
            label={translate('apply-order-data')}
            detail={translate('apply-order-data-detail', {
              records: counts.records,
              collections: collections.length,
            })}
          />
          {mirrorData && (
            <ApplyOrderStep
              index={4}
              label={translate('apply-order-mirror')}
              detail={translate('apply-order-mirror-detail', {
                records: counts.deletes,
              })}
            />
          )}
        </ol>
      </section>

      {dryRun.report && <DryRunReport report={dryRun.report} />}

      {error && (
        <pre className="identifier rounded-base border-2 border-destructive bg-secondary-background p-3 text-sm text-destructive">
          {error}
        </pre>
      )}

      <section className="flex flex-col gap-2 rounded-base border-2 bg-secondary-background p-4">
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <Checkbox checked disabled className="mt-0.5" />
          {translate('apply-backup-mandatory')}
        </label>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={reviewed}
            onCheckedChange={setReviewed}
            className="mt-0.5"
          />
          {translate('apply-reviewed')}
        </label>
      </section>

      <footer className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          {translate('apply-back')}
        </Button>

        <Button
          variant="outline"
          disabled={isBusy}
          className="gap-2"
          onClick={dryRun.run}
        >
          {dryRun.isRunning && <Loader2 className="size-4 animate-spin" />}
          {translate('apply-dry-run')}
        </Button>

        <Button
          size="lg"
          disabled={!reviewed || isBusy}
          onClick={applyRun.apply}
          className="ml-auto"
        >
          {translate('apply-run', { target: hostOf(target.url) })}
        </Button>
      </footer>

      {confirmWrite}
    </div>
  );
};
