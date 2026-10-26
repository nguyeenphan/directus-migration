'use client';

import { NOTHING } from '@/constants/changeStyles';
import { cn } from '@/utils/cn';

type TProps = {
  text: string | null;
  isNew?: boolean;
};

export const PlainValue = ({ text, isNew = false }: TProps) => (
  <span
    className={cn(
      'identifier wrap-break-word',
      text === null && 'text-muted-foreground/50',
      isNew && 'font-medium text-foreground',
    )}
  >
    {text ?? NOTHING}
  </span>
);
