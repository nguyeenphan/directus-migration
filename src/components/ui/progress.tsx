'use client';

import type * as React from 'react';
import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@/utils/cn';

function Progress({
  className,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn('flex flex-wrap gap-3', className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-glass-line',
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        'h-full bg-brand transition-all duration-500 ease-glide',
        className,
      )}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn('text-label', className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        'ml-auto font-mono text-xs text-muted-foreground tabular-nums',
        className,
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

// Text-mode bar for terminal-ish spots: ▓▓▓▓▓▓░░░░ 62%
function ProgressGlyphs({
  value,
  width = 24,
  className,
  ...props
}: React.ComponentProps<'span'> & { value: number; width?: number }) {
  const filled = Math.round((Math.min(100, Math.max(0, value)) / 100) * width);
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      data-slot="progress-glyphs"
      className={cn(
        'inline-flex gap-2 font-mono text-xs whitespace-pre tabular-nums',
        className,
      )}
      {...props}
    >
      <span aria-hidden>
        <span className="text-brand">{'▓'.repeat(filled)}</span>
        <span className="text-glass-line">{'░'.repeat(width - filled)}</span>
      </span>
      <span className="text-muted-foreground">{Math.round(value)}%</span>
    </span>
  );
}

export {
  Progress,
  ProgressGlyphs,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
};
