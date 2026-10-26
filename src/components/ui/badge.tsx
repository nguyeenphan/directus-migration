'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

// Mono pills. Status variants tint the color at 12–14% with a 22% hairline,
// like the site's "● Ready". Put a <BadgeDot /> first for the status dot.
const badgeVariants = cva(
  'group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full px-2.5 font-mono text-xs font-medium whitespace-nowrap transition-colors focus-visible:shadow-focus has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-muted text-muted-foreground shadow-hairline',
        outline:
          'text-muted-foreground shadow-hairline [a]:hover:text-foreground',
        brand:
          'bg-brand/14 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_26%,transparent)]',
        ok: 'bg-ok/14 text-ok shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ok)_22%,transparent)]',
        warn: 'bg-warn/12 text-warn shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--warn)_22%,transparent)]',
        destructive:
          'bg-destructive/12 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_22%,transparent)]',
        ghost: 'text-muted-foreground hover:bg-muted',
        link: 'underline-link rounded-none px-0 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}

function BadgeDot({
  pulse = false,
  className,
  ...props
}: React.ComponentProps<'span'> & { pulse?: boolean }) {
  return (
    <span
      data-slot="badge-dot"
      aria-hidden
      className={cn(
        'relative size-1.5 shrink-0 rounded-full bg-current',
        className,
      )}
      {...props}
    >
      {pulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
      )}
    </span>
  );
}

export { Badge, BadgeDot, badgeVariants };
