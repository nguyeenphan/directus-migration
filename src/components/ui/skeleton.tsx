'use client';

import { cn } from '@/utils/cn';

// Placeholder block filled with drifting ░▒ glyphs instead of a gray pulse.
// For real content that should decode into place, wrap it in <AsciiReveal loading>.
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('relative overflow-hidden rounded-md bg-muted', className)}
      {...props}
    >
      <span aria-hidden className="absolute inset-0 animate-glyph bg-glyph" />
    </div>
  );
}

export { Skeleton };
