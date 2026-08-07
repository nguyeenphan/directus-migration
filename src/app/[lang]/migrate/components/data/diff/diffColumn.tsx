'use client';

import type { collapseUnchanged } from '@/utils/wordDiff';

import { DiffGap } from './diffGap';
import { DiffLine, type TSide } from './diffLine';

type TProps = {
  blocks: ReturnType<typeof collapseUnchanged>;
  side: TSide;
};

export const DiffColumn = ({ blocks, side }: TProps) => (
  <div className="diff-dense overflow-x-auto p-2">
    {blocks.map((block, index) =>
      block.type === 'gap' ? (
        <DiffGap key={index} lines={block.lines} />
      ) : (
        block.lines.map((line, lineIndex) => (
          <DiffLine key={`${index}-${lineIndex}`} line={line} side={side} />
        ))
      ),
    )}
  </div>
);
