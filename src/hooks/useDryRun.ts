'use client';

import { useState, useTransition } from 'react';

import { runDryRun } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TDryRunReport } from '@/models/dryRun';
import type { TRecordExclusions } from '@/models/plan';

export const useDryRun = ({
  source,
  target,
  collections,
  excluded,
  schemaChanges,
}: {
  source: TConnection;
  target: TConnection;
  collections: string[];
  excluded: TRecordExclusions;
  schemaChanges: number;
}) => {
  const [report, setReport] = useState<TDryRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, startTransition] = useTransition();

  return {
    report,
    error,
    isRunning,

    run: () =>
      startTransition(async () => {
        setError(null);

        const result = await runDryRun(
          source,
          target,
          collections,
          schemaChanges,
          excluded,
        );

        if (result.ok) setReport(result.data);
        else setError(result.error);
      }),
  };
};
