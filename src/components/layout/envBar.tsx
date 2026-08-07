'use client';

import { ArrowRight } from 'lucide-react';

import { EnvEndpoint } from '@/components/layout/envEndpoint';
import { Stepper } from '@/components/layout/stepper';
import { ThemeToggle } from '@/components/layout/themeToggle';
import type { TConnection } from '@/models/connection';
import type { TBlocked, TStep } from '@/models/flow';

type TProps = {
  source: TConnection;
  target: TConnection;
  step: TStep;
  blocked: TBlocked;
  onNavigate: (step: TStep) => void;
  children?: React.ReactNode;
};

export const EnvBar = ({
  source,
  target,
  step,
  blocked,
  onNavigate,
  children,
}: TProps) => {
  return (
    <header className="sticky top-0 z-20">
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-[1600px] items-center justify-center px-6 py-2">
          <div className="absolute left-6 flex items-center gap-3">
            <EnvEndpoint connection={source} />
            <span aria-hidden>
              <ArrowRight />
            </span>
            <EnvEndpoint connection={target} />
          </div>

          <Stepper current={step} blocked={blocked} onNavigate={onNavigate} />

          <div className="absolute right-6 flex items-center gap-3">
            {children}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
