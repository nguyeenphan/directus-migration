'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { MAX_VIOLATIONS_SHOWN } from '@/constants/run';
import { useTranslate } from '@/hooks/useTranslate';
import type { TDryRunReport } from '@/models/dryRun';

type TProps = {
  line: TDryRunReport['lines'][number];
};

export const DryRunLine = ({ line }: TProps) => {
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
