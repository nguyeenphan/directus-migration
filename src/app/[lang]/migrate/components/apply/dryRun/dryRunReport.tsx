'use client';

import { useTranslate } from '@/hooks/useTranslate';
import type { TDryRunReport } from '@/models/dryRun';
import { cn } from '@/utils/cn';

import { DryRunLine } from './dryRunLine';

type TProps = {
  report: TDryRunReport;
};

export const DryRunReport = ({ report }: TProps) => {
  const translate = useTranslate();
  const hasProblems = report.totalViolations > 0;

  return (
    <section
      className={cn(
        'border',
        hasProblems ? 'border-2 border-destructive' : 'border-success',
      )}
    >
      <header className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-sm">
        <span className="font-semibold">{translate('dry-run-title')}</span>
        <span className="identifier text-muted-foreground">
          {translate('dry-run-summary', {
            rows: report.totalRows,
            schema: report.schemaChanges,
          })}
        </span>
        <span
          className={cn(
            'identifier ml-auto font-bold',
            hasProblems ? 'text-destructive' : 'text-success',
          )}
        >
          {translate(hasProblems ? 'dry-run-violations' : 'dry-run-clean', {
            count: report.totalViolations,
          })}
        </span>
      </header>

      <ul className="diff-dense max-h-72 overflow-y-auto">
        {report.lines.map((line) => (
          <DryRunLine key={line.collection} line={line} />
        ))}
      </ul>
    </section>
  );
};
