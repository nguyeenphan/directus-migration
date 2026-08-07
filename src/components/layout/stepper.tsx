'use client';

import { Database, Plug, Table2, UploadCloud } from 'lucide-react';

import { STEPS } from '@/constants/steps';
import { useTranslate } from '@/hooks/useTranslate';
import type { TBlocked, TStep } from '@/models/flow';
import { cn } from '@/utils/cn';

const ICONS = {
  connect: Plug,
  schema: Table2,
  data: Database,
  apply: UploadCloud,
} as const;

const MARKER_SIZE = 26;

type TProps = {
  current: TStep;
  blocked: TBlocked;
  onNavigate: (step: TStep) => void;
};

export const Stepper = ({ current, blocked, onNavigate }: TProps) => {
  const translate = useTranslate();
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label={translate('stepper-label')}>
      <ol className="grid w-104 grid-cols-4">
        {STEPS.map((step, index) => {
          const Icon = ICONS[step];
          const reason = blocked[step];
          const isEnabled = !reason;
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;

          return (
            <li key={step} className="relative flex flex-col items-center">
              {index > 0 && (
                <span
                  aria-hidden
                  style={{ top: MARKER_SIZE / 2 }}
                  className={cn(
                    'absolute right-1/2 z-0 h-px w-full',
                    index <= currentIndex ? 'bg-primary/50' : 'bg-border',
                  )}
                />
              )}

              <button
                type="button"
                disabled={!isEnabled}
                title={reason ? translate(reason) : undefined}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onNavigate(step)}
                className={cn(
                  'group relative flex flex-col items-center gap-1',
                  !isEnabled && 'cursor-not-allowed',
                )}
              >
                <span
                  style={{ width: MARKER_SIZE, height: MARKER_SIZE }}
                  className={cn(
                    'relative z-10 flex items-center justify-center rounded-full border transition-none',
                    isCurrent &&
                      'border-primary bg-primary text-primary-foreground',
                    isDone && 'border-primary/50 bg-background text-primary',
                    !isCurrent &&
                      !isDone &&
                      'border-transparent bg-muted text-muted-foreground/70',
                    isEnabled && !isCurrent && 'group-hover:border-primary/60',
                  )}
                >
                  <Icon className="size-3.5" />
                </span>

                <span
                  className={cn(
                    'whitespace-nowrap text-[11px] leading-none',
                    isCurrent
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {translate(`step-${step}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
