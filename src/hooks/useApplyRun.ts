'use client';

import { useState, useTransition } from 'react';

import { beginRun, readRun } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TRecordExclusions } from '@/models/plan';
import type { TRun } from '@/models/run';

/**
 * Held by the wizard, not by the apply step: a run outlives the screen that
 * started it, and the flow gate has to see it to keep the user on that screen.
 */
export const useApplyRun = ({
  source,
  target,
  collections,
  excluded,
  force,
  mirrorData,
}: {
  source: TConnection;
  target: TConnection;
  collections: ReadonlySet<string>;
  excluded: TRecordExclusions;
  force: boolean;
  mirrorData: boolean;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [run, setRun] = useState<TRun | null>(null);
  const [isStarting, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setError(null);
      setNeedsConfirmation(false);

      try {
        const { id } = await beginRun({
          source,
          target,
          collections: [...collections],
          excluded,
          applySchema: false,
          schemaCollections: [],
          force,
          mirrorData,
        });

        setRun(await readRun(id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });

  return {
    error,
    needsConfirmation,
    run,
    isStarting,

    setRun,
    setNeedsConfirmation,
    start,
    apply: () => setNeedsConfirmation(true),
    clear: () => {
      setRun(null);
      setError(null);
    },
  };
};

export type TApplyRun = ReturnType<typeof useApplyRun>;
