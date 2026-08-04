'use client';

import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/useTranslate';
import { isFinished, type TRun } from '@/models/run';

import { RunView } from '../apply/runView';

export const SchemaRunView = ({
  run,
  isPlanning,
  onRunChange,
  onRetry,
  onBack,
  onContinue,
}: {
  run: TRun;
  isPlanning: boolean;
  onRunChange: (run: TRun) => void;
  onRetry: () => void;
  onBack: () => void;
  onContinue: () => void;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <RunView run={run} onRunChange={onRunChange} onRetry={onRetry} />

      {isFinished(run) && (
        <footer className="flex items-center gap-3 border-t pt-3">
          <Button variant="ghost" onClick={onBack} disabled={isPlanning}>
            {translate('schema-run-back')}
          </Button>

          <Button
            size="lg"
            className="ml-auto"
            disabled={isPlanning}
            onClick={onContinue}
          >
            {translate('schema-run-continue')}
          </Button>
        </footer>
      )}
    </div>
  );
};
