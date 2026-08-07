'use client';

import { useTranslate } from '@/hooks/useTranslate';
import { runOutcome, type TRun } from '@/models/run';

import { OutcomeBucket } from './outcomeBucket';

type TProps = {
  run: TRun;
};

export const RunOutcome = ({ run }: TProps) => {
  const translate = useTranslate();
  const outcome = runOutcome(run);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <OutcomeBucket
        title={translate('run-written', { count: outcome.written.length })}
        units={outcome.written}
      />
      <OutcomeBucket
        title={translate('run-failed', { count: outcome.failed.length })}
        units={outcome.failed}
        tone="error"
      />
      <OutcomeBucket
        title={translate('run-untouched', { count: outcome.untouched.length })}
        units={outcome.untouched}
      />
    </div>
  );
};
