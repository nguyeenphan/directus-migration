'use client';

import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useApplyRun } from '@/hooks/useApplyRun';
import { useTranslate } from '@/hooks/useTranslate';
import { hostOf, type TConnection } from '@/models/connection';
import type { TPlan } from '@/models/plan';

import { ConfirmWriteDialog } from './confirmWriteDialog';
import { DryRunReport } from './dryRunReport';
import { RunView } from './runView';

type TProps = {
  source: TConnection;
  target: TConnection;
  plan: TPlan;
  dataSelection: Set<string>;
  mirrorData: boolean;
  sequencesConfirmed: boolean;
  force: boolean;
  onBack: () => void;
};

export const ApplyStep = ({
  source,
  target,
  plan,
  dataSelection,
  mirrorData,
  sequencesConfirmed,
  force,
  onBack,
}: TProps) => {
  const translate = useTranslate();

  const [reviewed, setReviewed] = useState(false);

  const collections = useMemo(() => [...dataSelection], [dataSelection]);

  const counts = useMemo(() => {
    const selected = plan.data.filter((row) =>
      dataSelection.has(row.collection),
    );

    return {
      records: selected.reduce(
        (total, row) => total + row.toCreate + (row.toUpdate ?? 0),
        0,
      ),
      deletes: mirrorData
        ? selected.reduce((total, row) => total + row.extraInTarget, 0)
        : 0,
      sequences: selected.length,
    };
  }, [plan, dataSelection, mirrorData]);

  const applyRun = useApplyRun({
    source,
    target,
    collections,
    schemaChanges: plan.schema.collections.length,
    force,
    mirrorData,
  });

  if (applyRun.run) {
    return (
      <RunView
        run={applyRun.run}
        showSequenceResets={!sequencesConfirmed}
        onRunChange={applyRun.setRun}
        onRetry={applyRun.apply}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <h1 className="text-lg font-semibold">{translate('apply-title')}</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label={translate('apply-tile-records')} value={counts.records} />
        <Tile
          label={translate('apply-tile-collections')}
          value={collections.length}
        />
        <Tile
          label={translate('apply-tile-deletes')}
          value={counts.deletes}
          tone="danger"
        />
      </section>

      <section className="border p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {translate('apply-order-title')}
        </h2>
        <ol className="diff-dense">
          <Step
            index={1}
            label={translate('apply-order-backup')}
            detail={translate('apply-order-backup-detail')}
          />
          <Step
            index={2}
            label={translate('apply-order-files')}
            detail={translate('apply-order-files-detail')}
          />
          <Step
            index={3}
            label={translate('apply-order-data')}
            detail={translate('apply-order-data-detail', {
              records: counts.records,
              collections: collections.length,
            })}
          />
          {mirrorData && (
            <Step
              index={4}
              label={translate('apply-order-mirror')}
              detail={translate('apply-order-mirror-detail', {
                records: counts.deletes,
              })}
            />
          )}
        </ol>
      </section>

      {applyRun.report && <DryRunReport report={applyRun.report} />}

      {applyRun.error && (
        <pre className="identifier border-2 border-destructive p-3 text-sm text-destructive">
          {applyRun.error}
        </pre>
      )}

      <section className="flex flex-col gap-2 border p-4">
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
          disabled={applyRun.isBusy}
          className="gap-2"
          onClick={applyRun.dryRun}
        >
          {applyRun.isBusy && <Loader2 className="size-4 animate-spin" />}
          {translate('apply-dry-run')}
        </Button>

        <Button
          size="lg"
          disabled={!reviewed || applyRun.isBusy}
          onClick={applyRun.apply}
          className="ml-auto"
        >
          {translate('apply-run', { target: hostOf(target.url) })}
        </Button>
      </footer>

      <ConfirmWriteDialog
        open={applyRun.needsConfirmation}
        host={hostOf(target.url)}
        recordCount={counts.records}
        deleteCount={counts.deletes}
        onOpenChange={applyRun.setNeedsConfirmation}
        onConfirm={applyRun.start}
      />
    </div>
  );
};

const Tile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger';
}) => (
  <div className="border p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p
      className={`identifier text-2xl font-bold tabular-nums ${
        tone === 'danger' && value > 0 ? 'text-destructive' : ''
      }`}
    >
      {value}
    </p>
  </div>
);

const Step = ({
  index,
  label,
  detail,
}: {
  index: number;
  label: string;
  detail: string;
}) => (
  <li className="flex gap-3">
    <span className="identifier w-4 shrink-0 text-muted-foreground tabular-nums">
      {index}.
    </span>
    <span className="flex-1">{label}</span>
    <span className="identifier text-muted-foreground">{detail}</span>
  </li>
);
