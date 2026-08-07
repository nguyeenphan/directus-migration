'use client';

import { useState, useTransition } from 'react';

import { beginRun, readRun, runDryRun } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TDryRunReport } from '@/models/dryRun';
import type { TRun } from '@/models/run';

export const useApplyRun = ({
  source,
  target,
  collections,
  schemaChanges,
  force,
  mirrorData,
}: {
  source: TConnection;
  target: TConnection;
  collections: string[];
  schemaChanges: number;
  force: boolean;
  mirrorData: boolean;
}) => {
  const [report, setReport] = useState<TDryRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [run, setRun] = useState<TRun | null>(null);
  const [isBusy, startBusy] = useTransition();

  const start = () =>
    startBusy(async () => {
      try {
        const { id } = await beginRun({
          source,
          target,
          collections,
          applySchema: false,
          schemaCollections: [],
          force,
          mirrorData,
        });

        setNeedsConfirmation(false);
        setRun(await readRun(id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });

  return {
    report,
    error,
    needsConfirmation,
    run,
    isBusy,

    setRun,
    setNeedsConfirmation,
    start,
    dryRun: () =>
      startBusy(async () => {
        setError(null);
        const result = await runDryRun(
          source,
          target,
          collections,
          schemaChanges,
        );

        if (result.ok) setReport(result.data);
        else setError(result.error);
      }),
    apply: () => setNeedsConfirmation(true),
  };
};
