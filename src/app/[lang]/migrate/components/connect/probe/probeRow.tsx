'use client';

import type { ReactNode } from 'react';

type TProps = {
  label: string;
  children: ReactNode;
};

export const ProbeRow = ({ label, children }: TProps) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="identifier">{children}</dd>
  </>
);
