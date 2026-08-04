'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  readBackup,
  readRun,
  rollback,
  stopRun,
} from '@/app/[lang]/migrate/operations';
import { RUN_POLL_INTERVAL_MS } from '@/constants/run';
import { isFinished, type TRun } from '@/models/run';

export const useRunActions = (run: TRun, onRunChange: (run: TRun) => void) => {
  const [isActing, startActing] = useTransition();
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  const finished = isFinished(run);

  useEffect(() => {
    if (finished) return;

    const timer = setInterval(async () => {
      const next = await readRun(run.id);
      if (next) onRunChange(next);
    }, RUN_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [finished, run.id, onRunChange]);

  return {
    finished,
    isActing,
    rollbackError,

    stop: () =>
      startActing(async () => {
        const next = await stopRun(run.id);
        if (next) onRunChange(next);
      }),

    rollback: () =>
      startActing(async () => {
        const result = await rollback(run.id);

        if (result.ok) {
          setRollbackError(null);
          onRunChange(result.data);
        } else setRollbackError(result.error);
      }),

    download: () =>
      startActing(async () => {
        const json = await readBackup(run.id);
        if (!json) return;

        const url = URL.createObjectURL(
          new Blob([json], { type: 'application/json' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-${run.targetHost}-${run.startedAt}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }),
  };
};
