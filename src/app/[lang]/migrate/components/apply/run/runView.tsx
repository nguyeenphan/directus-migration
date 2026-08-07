'use client';

import { Download, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RUN_STAGES } from '@/constants/run';
import { useRunActions } from '@/hooks/useRunActions';
import { useTranslate } from '@/hooks/useTranslate';
import { runProgress, stageStatus, type TRun, wroteData } from '@/models/run';

import { RollbackDialog } from '../../dialogs/rollbackDialog';
import { RecompareButton } from '../../recompareButton';
import { RunLog } from './runLog';
import { RunOutcome } from './runOutcome';
import { SequenceResets } from './sequenceResets';
import { StatusMark } from './statusMark';

type TProps = {
  run: TRun;
  showSequenceResets?: boolean;
  onRunChange: (run: TRun) => void;

  onRetry: () => void;

  isRecomparing?: boolean;
  onRecompare?: () => void;
};

export const RunView = ({
  run,
  showSequenceResets = true,
  onRunChange,
  onRetry,
  isRecomparing = false,
  onRecompare,
}: TProps) => {
  const translate = useTranslate();
  const [confirmRollback, setConfirmRollback] = useState(false);

  const { finished, isActing, rollbackError, stop, rollback, download } =
    useRunActions(run, onRunChange);

  const progress = runProgress(run);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">
          {translate(`run-status-${run.status}`)}
        </h1>
        <span className="identifier text-sm text-muted-foreground tabular-nums">
          {progress.settled} / {progress.total}
        </span>

        {!finished && (
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

      <Progress value={progress.percent} />

      <ul className="flex flex-wrap gap-2 text-sm">
        {RUN_STAGES.map((stage) => (
          <li
            key={stage}
            className="flex items-center gap-2 border px-3 py-1.5"
          >
            <StatusMark status={stageStatus(run, stage)} />
            <span className="identifier">{translate(`stage-${stage}`)}</span>
          </li>
        ))}
      </ul>

      {finished && <RunOutcome run={run} />}

      {finished && showSequenceResets && <SequenceResets run={run} />}

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

          {rollbackError && (
            <pre className="identifier max-w-full overflow-x-auto text-xs text-destructive">
              {rollbackError}
            </pre>
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
