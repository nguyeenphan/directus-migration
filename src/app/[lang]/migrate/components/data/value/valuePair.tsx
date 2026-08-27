'use client';

import { DIFF_VALUE } from '@/constants/changeStyles';
import type { TFieldValue } from '@/models/plan';
import { cn } from '@/utils/cn';

import { WordDiffView } from '../diff/wordDiffView';
import { PlainValue } from './plainValue';

type TProps = {
  field: TFieldValue;
};

const DiffLine = ({
  side,
  children,
}: {
  side: 'before' | 'after';
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      'grid grid-cols-[1rem_1fr] items-baseline gap-2 px-1.5',
      DIFF_VALUE[side],
    )}
  >
    <span className="identifier text-muted-foreground">
      {side === 'before' ? '−' : '+'}
    </span>
    {children}
  </span>
);

/**
 * One value column, read top to bottom: what the target holds, then what it
 * becomes. A record that is new has no `before`, so it prints the added line
 * alone — no column is spent saying "nothing".
 */
export const ValuePair = ({ field }: TProps) => {
  if (field.kind !== 'modify') {
    return <PlainValue text={field.before ?? field.after} />;
  }

  if (field.display === 'longtext' && field.before !== null) {
    return (
      <WordDiffView before={field.before ?? ''} after={field.after ?? ''} />
    );
  }

  const value = (side: 'before' | 'after') => (
    <PlainValue
      text={side === 'before' ? field.before : field.after}
      isNew={side === 'after'}
    />
  );

  return (
    <span className="flex flex-col gap-0.5">
      {field.before !== null && (
        <DiffLine side="before">{value('before')}</DiffLine>
      )}
      <DiffLine side="after">{value('after')}</DiffLine>
    </span>
  );
};
