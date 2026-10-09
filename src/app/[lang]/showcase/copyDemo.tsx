'use client';

import { CopyButton } from '@/components/common/copyButton';

const SAMPLE = '0f8fad5b-d9cb-469f-a165-70867728950e';

export const CopyDemo = () => (
  <span className="identifier inline-flex items-center gap-2 text-sm">
    {SAMPLE}
    <CopyButton text={() => SAMPLE} label="id" />
  </span>
);
