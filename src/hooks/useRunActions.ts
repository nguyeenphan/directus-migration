'use client';

import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import {
  confirmBackup,
  readBackup,
  readRun,
  rollback,
  stopRun,
} from '@/app/[lang]/migrate/operations';
import { RUN_POLL_INTERVAL_MS } from '@/constants/run';
import {
  isAwaitingBackup,
  isFinished,
  isRollingBack,
  type TRun,
} from '@/models/run';

export const useRunActions = (run: TRun, onRunChange: (run: TRun) => void) => {
  const [isActing, startActing] = useTransition();
  const [backupSaved, setBackupSaved] = useState(false);

  const finished = isFinished(run);

  // The poll belongs to the run, not to the handler: `useEffectEvent` keeps
  // `onRunChange` out of the deps, so a caller passing a fresh closure can no
  // longer restart the timer — and with it the one-second clock — per render.
  const poll = useEffectEvent(async () => {
    const next = await readRun(run.id);
    if (next) onRunChange(next);
  });

  useEffect(() => {
    if (finished) return;

    const timer = setInterval(poll, RUN_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [finished, run.id]);

  return {
    finished,
    awaitingBackup: isAwaitingBackup(run),
    rollingBack: isRollingBack(run),
    backupSaved,
    isActing,

    stop: () =>
      startActing(async () => {
        const next = await stopRun(run.id);
        if (next) onRunChange(next);
      }),

    rollback: () =>
      startActing(async () => {
        // Shown at once so polling resumes and the rollback log streams in.
        onRunChange({ ...run, status: 'rolling-back' });

        const result = await rollback(run.id);

        if (result.ok) return onRunChange(result.data);

        // The failure is in the run log; re-read the run to show it.
        const settled = await readRun(run.id);
        if (settled) onRunChange(settled);
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
        setBackupSaved(true);
      }),

    proceed: () =>
      startActing(async () => {
        const next = await confirmBackup(run.id);
        if (next) onRunChange(next);
      }),
  };
};
