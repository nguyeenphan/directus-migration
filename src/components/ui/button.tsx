import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/cn';

// Motion: hover is a 180ms color/shadow ease plus a 1px lift on solid buttons;
// press scales down on the site's 120ms press curve.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap outline-none select-none transition-[background-color,color,box-shadow,translate,scale] duration-180 ease-out active:not-aria-[haspopup]:scale-[0.97] active:not-aria-[haspopup]:duration-120 active:not-aria-[haspopup]:ease-press focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 aria-invalid:ring-2 aria-invalid:ring-destructive/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:-translate-y-px hover:bg-primary/90 dark:hover:bg-white',
        brand:
          'bg-brand text-brand-foreground hover:-translate-y-px hover:bg-brand/90',
        secondary:
          'bg-secondary text-secondary-foreground shadow-glass-sm hover:bg-foreground/12 aria-expanded:bg-foreground/12',
        outline:
          'text-foreground shadow-hairline hover:bg-accent aria-expanded:bg-accent',
        ghost:
          'text-muted-foreground hover:bg-foreground/6 hover:text-foreground aria-expanded:bg-foreground/6 aria-expanded:text-foreground',
        destructive:
          'bg-destructive/12 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_25%,transparent)] hover:bg-destructive/20 focus-visible:ring-destructive',
        link: 'underline-link h-auto! rounded-none px-0! text-foreground active:not-aria-[haspopup]:scale-100',
      },
      size: {
        default:
          'h-11 gap-2 px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xs: "h-7 gap-1 px-2.5 font-mono text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-12 gap-2 px-5 text-[15px]',
        icon: 'size-11',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
