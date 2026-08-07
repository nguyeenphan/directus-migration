'use client';

import { useState } from 'react';

import { useTranslate } from '@/hooks/useTranslate';
import type { TDiffLine } from '@/utils/wordDiff';

import { DiffLine } from './diffLine';

type TProps = {
  lines: TDiffLine[];
};

export const DiffGap = ({ lines }: TProps) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <>
        {lines.map((line, index) => (
          <DiffLine key={index} line={line} side="both" />
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
