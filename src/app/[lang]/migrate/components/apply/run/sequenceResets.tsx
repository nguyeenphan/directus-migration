'use client';

import { CopyButton } from '@/components/common/copyButton';
import { useTranslate } from '@/hooks/useTranslate';
import { sequenceResetSql, type TRun } from '@/models/run';

type TProps = {
  run: TRun;
};

export const SequenceResets = ({ run }: TProps) => {
  const translate = useTranslate();

  if (run.sequenceResets.length === 0) return null;

  const title = translate('run-sequence-title', {
    count: run.sequenceResets.length,
  });

  return (
    <section className="border border-warning p-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-warning">{title}</p>
        <CopyButton
          className="ml-auto"
          label={title}
          text={() => sequenceResetSql(run.sequenceResets)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {translate('run-sequence-detail')}
      </p>
      <pre className="identifier mt-2 max-h-40 overflow-auto bg-muted p-2 text-xs">
        {sequenceResetSql(run.sequenceResets)}
      </pre>
    </section>
  );
};
