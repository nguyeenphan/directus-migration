'use client';

import { CopyButton } from '@/components/common/copyButton';
import type { TRunUnit } from '@/models/run';
import { cn } from '@/utils/cn';

type TProps = {
  title: string;
  units: TRunUnit[];
  tone?: 'error';
};

export const OutcomeBucket = ({ title, units, tone }: TProps) => (
  <section
    className={cn(
      'border p-3',
      tone === 'error' && units.length > 0 && 'border-2 border-destructive',
    )}
  >
    <div className="flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {units.length > 0 && (
        <CopyButton
          className="ml-auto"
          label={title}
          text={() =>
            units
              .map((unit) => [unit.name, unit.error].filter(Boolean).join(': '))
              .join('\n')
          }
        />
      )}
    </div>
    <ul className="diff-dense mt-1 max-h-40 overflow-auto">
      {units.map((unit) => (
        <li
          key={unit.name}
          className="identifier whitespace-nowrap"
          title={unit.error ?? undefined}
        >
          {unit.name}
          {unit.written > 0 && (
            <span className="text-muted-foreground"> · {unit.written}</span>
          )}
          {unit.error && (
            <span className="block whitespace-nowrap text-xs text-destructive">
              {unit.error}
            </span>
          )}
        </li>
      ))}
    </ul>
  </section>
);
