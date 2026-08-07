'use client';

import { CopyButton } from '@/components/common/copyButton';
import { NOTHING } from '@/constants/changeStyles';
import { cn } from '@/utils/cn';

type TProps = {
  label: string;
  text: string | null;
  isNew?: boolean;
};

export const FieldValueSide = ({ label, text, isNew = false }: TProps) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {text !== null && (
        <CopyButton className="ml-auto" label={label} text={() => text} />
      )}
    </div>
    <pre
      className={cn(
        'identifier max-h-[50vh] overflow-auto whitespace-pre-wrap wrap-break-word border p-2 text-xs',
        text === null && 'text-muted-foreground/50',
        isNew && 'font-medium text-foreground',
      )}
    >
      {text ?? NOTHING}
    </pre>
  </div>
);
