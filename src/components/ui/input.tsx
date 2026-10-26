'use client';

import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/utils/cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-lg bg-sunken px-3.5 text-sm shadow-hairline transition-shadow outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-mono file:text-xs file:text-foreground placeholder:text-faint focus-visible:shadow-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-invalid',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
