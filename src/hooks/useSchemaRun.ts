'use client';

import { useState, useTransition } from 'react';

import { beginRun, readRun } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TRun } from '@/models/run';

export const useSchemaRun = ({
  source,
  target,
  collections,
  force,
}: {
  source: TConnection;
  target: TConnection;
  collections: ReadonlySet<string>;
  force: boolean;
}) => {
  const [run, setRun] = useState<TRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isStarting, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setError(null);

      try {
        const { id } = await beginRun({
          source,
          target,
          collections: [],
          applySchema: true,
          schemaCollections: [...collections],
          force,
        });

        setNeedsConfirmation(false);
        setRun(await readRun(id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });

  return {
    run,
    error,
    needsConfirmation,
    isStarting,

    setRun,
    setNeedsConfirmation,
    start,
    applyNow: () => setNeedsConfirmation(true),
    clear: () => setRun(null),
  };
};
