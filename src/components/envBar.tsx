'use client';

import { ArrowRight } from 'lucide-react';

import { Stepper } from '@/components/stepper';
import { ThemeToggle } from '@/components/themeToggle';
import { useTranslate } from '@/hooks/useTranslate';
import { hostOf, type TConnection } from '@/models/connection';
import type { TBlocked, TStep } from '@/models/flow';
import { cn } from '@/utils/cn';

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
            <End connection={source} />
            <span aria-hidden>
              <ArrowRight />
            </span>
            <End connection={target} />
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

const End = ({ connection }: { connection: TConnection }) => {
  const translate = useTranslate();
  const host = hostOf(connection.url);
  return (
    <span className="flex flex-col leading-tight">
      <span
        className={cn(
          'identifier text-sm font-bold',
          !host && 'font-normal text-muted-foreground/60',
        )}
      >
        {host || translate('env-not-set')}
      </span>
    </span>
  );
};
