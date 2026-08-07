'use client';

import { Check, CircleMinus, Loader2, X } from 'lucide-react';

import type { TUnitStatus } from '@/models/run';

type TProps = {
  status: TUnitStatus;
};

export const StatusMark = ({ status }: TProps) => {
  if (status === 'running') {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  }
  if (status === 'done') {
    return <Check className="size-4 shrink-0 text-success" />;
  }
  if (status === 'failed') {
    return <X className="size-4 shrink-0 text-destructive" />;
  }

  return <CircleMinus className="size-4 shrink-0 text-muted-foreground" />;
};
