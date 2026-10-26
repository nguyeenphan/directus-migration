'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow] outline-none hover:text-foreground focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:shadow-invalid aria-pressed:bg-glass-strong aria-pressed:text-foreground aria-pressed:shadow-glass-sm data-[state=on]:bg-glass-strong [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'bg-transparent shadow-hairline hover:bg-muted',
      },
      size: {
        default:
          'h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
