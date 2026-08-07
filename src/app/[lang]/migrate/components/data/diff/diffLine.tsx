'use client';

import { DIFF_VALUE } from '@/constants/changeStyles';
import type { TDiffLine } from '@/utils/wordDiff';

export type TSide = 'before' | 'after' | 'both';

type TProps = {
  line: TDiffLine;
  side: TSide;
};

export const DiffLine = ({ line, side }: TProps) => (
  <p className="identifier whitespace-pre-wrap wrap-break-word">
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
    {line.ops.length === 0 && ' '}
  </p>
);
