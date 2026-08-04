'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { MAX_VIOLATIONS_SHOWN } from '@/constants/run';
import { useTranslate } from '@/hooks/useTranslate';
import type { TDryRunReport } from '@/models/dryRun';
import { cn } from '@/utils/cn';

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
          <Line key={line.collection} line={line} />
        ))}
      </ul>
    </section>
  );
};

const Line = ({ line }: { line: TDryRunReport['lines'][number] }) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);
  const hasProblems = line.violations.length > 0;

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={!hasProblems}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-3 text-left hover:bg-accent/60 disabled:hover:bg-transparent"
      >
        {hasProblems ? (
          isOpen ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )
        ) : (
          <span className="w-3.5" />
        )}

        <span className="identifier min-w-0 flex-1 truncate">
          {line.collection}
        </span>
        <span className="identifier shrink-0 tabular-nums text-muted-foreground">
          +{line.toCreate} ~{line.toUpdate}
        </span>
        {hasProblems && (
          <span className="identifier shrink-0 font-bold text-destructive">
            ! {line.violations.length}
          </span>
        )}
      </button>

      {isOpen && (
        <ul className="identifier bg-destructive-muted px-3 py-1 text-xs text-destructive">
          {line.violations.map((violation) => (
            <li key={violation}>{violation}</li>
          ))}
          {line.violations.length === MAX_VIOLATIONS_SHOWN && (
            <li className="opacity-70">{translate('dry-run-truncated')}</li>
          )}
        </ul>
      )}
    </li>
  );
};
