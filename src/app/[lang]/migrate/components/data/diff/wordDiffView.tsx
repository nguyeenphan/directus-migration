'use client';

import { useMemo, useState } from 'react';

import { useTranslate } from '@/hooks/useTranslate';
import { cn } from '@/utils/cn';
import { collapseUnchanged, toDiffLines, wordDiff } from '@/utils/wordDiff';

import { DiffColumn } from './diffColumn';

type TProps = {
  before: string;
  after: string;
};

export const WordDiffView = ({ before, after }: TProps) => {
  const translate = useTranslate();
  const [isSideBySide, setIsSideBySide] = useState(false);

  const blocks = useMemo(
    () => collapseUnchanged(toDiffLines(wordDiff(before, after))),
    [before, after],
  );

  return (
    <div className="border">
      <div className="flex items-center gap-1 border-b px-2 py-1">
        {[false, true].map((mode) => (
          <button
            key={String(mode)}
            type="button"
            onClick={() => setIsSideBySide(mode)}
            className={cn(
              'px-2 py-0.5 text-[11px] uppercase tracking-wide',
              isSideBySide === mode
                ? 'bg-accent font-semibold'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {translate(mode ? 'diff-side-by-side' : 'diff-inline')}
          </button>
        ))}
      </div>

      {isSideBySide ? (
        <div className="grid grid-cols-2 divide-x">
          <DiffColumn blocks={blocks} side="before" />
          <DiffColumn blocks={blocks} side="after" />
        </div>
      ) : (
        <DiffColumn blocks={blocks} side="both" />
      )}
    </div>
  );
};
