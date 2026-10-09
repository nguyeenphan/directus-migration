'use client';

import { Download, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RUN_STAGES } from '@/constants/run';
import { useRunActions } from '@/hooks/useRunActions';
import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection } from '@/models/connection';
import { runProgress, stageStatus, type TRun, wroteData } from '@/models/run';

import { RelaxBanner } from '../../connect/gate/relaxBanner';
import { RollbackDialog } from '../../dialogs/rollbackDialog';
import { RecompareButton } from '../../recompareButton';
import { RunLog } from './runLog';
import { RunOutcome } from './runOutcome';
import { SequenceResets } from './sequenceResets';
import { StatusMark } from './statusMark';

type TProps = {
  run: TRun;
  onRunChange: (run: TRun) => void;

  onRetry: () => void;

  // Lets a run that could not restore its constraints be repaired in place.
  target?: TConnection;

  isRecomparing?: boolean;
  onRecompare?: () => void;
};

export const RunView = ({
  run,
  onRunChange,
  onRetry,
  target,
  isRecomparing = false,
  onRecompare,
}: TProps) => {
  const translate = useTranslate();
  const [confirmRollback, setConfirmRollback] = useState(false);

  const {
    finished,
    awaitingBackup,
    backupSaved,
    rollingBack,
    isActing,
    stop,
    rollback,
    download,
    proceed,
  } = useRunActions(run, onRunChange);

  const progress = runProgress(run);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 -mr-1 overflow-y-auto pr-1 pb-1">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-heading">
          {translate(`run-status-${run.status}`)}
        </h1>
        <span className="identifier text-sm text-muted-foreground tabular-nums">
          {progress.settled} / {progress.total}
        </span>

        {!finished && !rollingBack && (
          <Button
            variant="outline"
            size="sm"
            disabled={run.stopRequested || isActing}
            onClick={stop}
          >
            {translate(run.stopRequested ? 'run-stopping' : 'run-stop')}
          </Button>
        )}
      </header>

      {awaitingBackup && (
        <section className="flex flex-wrap items-center gap-3 rounded-base border-2 border-warning bg-secondary-background p-3">
          <div className="min-w-0 flex-1">
            <p className="font-heading text-warning">
              {translate('run-backup-gate-title')}
            </p>
            <p className="text-sm text-muted-foreground">
              {translate('run-backup-gate-detail', { target: run.targetHost })}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={download}
            disabled={isActing}
            className="gap-2"
          >
            <Download className="size-4" />
            {translate('run-download-backup')}
          </Button>

          <Button onClick={proceed} disabled={!backupSaved || isActing}>
            {translate('run-backup-gate-continue')}
          </Button>
        </section>
      )}

      <Progress value={progress.percent} />

      <ul className="flex flex-wrap gap-2 text-sm">
        {RUN_STAGES.map((stage) => (
          <li
            key={stage}
            className="flex items-center gap-2 rounded-base border-2 bg-secondary-background px-3 py-1.5"
          >
            <StatusMark status={stageStatus(run, stage)} />
            <span className="identifier">{translate(`stage-${stage}`)}</span>
          </li>
        ))}
      </ul>

      {finished && target && (
        <RelaxBanner target={target} canRepair isUnrestored />
      )}

      {finished && <RunOutcome run={run} />}

      {finished && <SequenceResets run={run} />}

      <RunLog run={run} />

      {finished && (
        <footer className="flex flex-wrap items-center gap-3 border-t pt-3">
          <Button
            variant="outline"
            onClick={download}
            disabled={!run.hasBackup || isActing}
            className="gap-2"
          >
            <Download className="size-4" />
            {translate('run-download-backup')}
          </Button>

          {run.status !== 'rolled-back' && run.status !== 'succeeded' && (
            <Button onClick={onRetry} disabled={isActing} className="gap-2">
              <RotateCcw className="size-4" />
              {translate('run-retry')}
            </Button>
          )}

          {onRecompare && (
            <RecompareButton
              isRecomparing={isRecomparing}
              onRecompare={onRecompare}
            />
          )}

          {run.hasBackup && wroteData(run) && run.status !== 'rolled-back' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isActing}
              onClick={() => setConfirmRollback(true)}
              className="ml-auto gap-2 text-muted-foreground hover:text-destructive"
            >
              {isActing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Undo2 className="size-4" />
              )}
              {translate('run-rollback')}
            </Button>
          )}
        </footer>
      )}

      <RollbackDialog
        open={confirmRollback}
        target={run.targetHost}
        onOpenChange={setConfirmRollback}
        onConfirm={() => {
          setConfirmRollback(false);
          rollback();
        }}
      />
    </div>
  );
};
