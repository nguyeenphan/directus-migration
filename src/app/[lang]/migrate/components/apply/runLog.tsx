'use client';

import { useEffect, useRef } from 'react';

import { CopyButton } from '@/components/copyButton';
import { useTranslate } from '@/hooks/useTranslate';
import type { TLogLevel, TRun } from '@/models/run';
import { cn } from '@/utils/cn';
import { timeOfIso } from '@/utils/time';

const TONE: Record<TLogLevel, string> = {
  info: 'text-foreground',
  success: 'text-success',
  warn: 'text-warning',
  error: 'text-destructive',
};

export const RunLog = ({ run }: { run: TRun }) => {
  const translate = useTranslate();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [run.log.length]);

  return (
    <section className="border">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {translate('run-log')}
        </h2>
        <CopyButton
          className="ml-auto"
          label={translate('run-log')}
          text={() =>
            run.log
              .map((line) => `${timeOfIso(line.at)} ${line.message}`)
              .join('\n')
          }
        />
      </div>
      <div className="diff-dense max-h-64 overflow-y-auto p-2">
        {run.log.map((line, index) => (
          <p
            key={index}
            className={cn('identifier whitespace-pre-wrap', TONE[line.level])}
          >
            <span className="text-muted-foreground">{timeOfIso(line.at)} </span>
            {line.message}
          </p>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
};
