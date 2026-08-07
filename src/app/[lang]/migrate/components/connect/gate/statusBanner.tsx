'use client';

import type { ReactNode } from 'react';

const TONE = {
  ok: 'border-success text-success',
  warning: 'border-warning text-warning',
  error: 'border-2 border-destructive text-destructive',
} as const;

type TProps = {
  tone: keyof typeof TONE;
  icon: ReactNode;
  children: ReactNode;
};

export const StatusBanner = ({ tone, icon, children }: TProps) => (
  <div className={`flex items-start gap-2 border p-3 ${TONE[tone]}`}>
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);
