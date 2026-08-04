'use client';

import { useMemo, useState } from 'react';

import { DIFF_VALUE } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import { cn } from '@/utils/cn';
import {
  collapseUnchanged,
  type TDiffLine,
  toDiffLines,
  wordDiff,
} from '@/utils/wordDiff';

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
          <Column blocks={blocks} side="before" />
          <Column blocks={blocks} side="after" />
        </div>
      ) : (
        <Column blocks={blocks} side="both" />
      )}
    </div>
  );
};

type TSide = 'before' | 'after' | 'both';

const Column = ({
  blocks,
  side,
}: {
  blocks: ReturnType<typeof collapseUnchanged>;
  side: TSide;
}) => (
  <div className="diff-dense overflow-x-auto p-2">
    {blocks.map((block, index) =>
      block.type === 'gap' ? (
        <Gap key={index} lines={block.lines} />
      ) : (
        block.lines.map((line, lineIndex) => (
          <Line key={`${index}-${lineIndex}`} line={line} side={side} />
        ))
      ),
    )}
  </div>
);

const Line = ({ line, side }: { line: TDiffLine; side: TSide }) => (
  <p className="identifier whitespace-pre-wrap break-words">
    {line.ops
      .filter((op) => {
        if (side === 'before') return op.type !== 'add';
        if (side === 'after') return op.type !== 'del';
        return true;
      })
      .map((op, index) => (
        <span
          key={index}

          className={
            op.type === 'add'
              ? DIFF_VALUE.after
              : op.type === 'del'
                ? DIFF_VALUE.before
                : undefined
          }
        >
          {op.text}
        </span>
      ))}
    {line.ops.length === 0 && ' '}
  </p>
);

const Gap = ({ lines }: { lines: TDiffLine[] }) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <>
        {lines.map((line, index) => (
          <Line key={index} line={line} side="both" />
        ))}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="identifier block w-full py-0.5 text-left text-muted-foreground/70 hover:text-foreground"
    >
      ··· {translate('diff-unchanged-lines', { count: lines.length })}
    </button>
  );
};
