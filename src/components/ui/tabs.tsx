'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        'group/tabs flex gap-3 data-horizontal:flex-col',
        className,
      )}
      {...props}
    />
  );
}

// default = the site's segmented control (Preset · Wave from): sunken pill track,
// glass pill slides to the active tab on Osmo's glide curve (Toggle Switch).
const tabsListVariants = cva(
  'group/tabs-list relative inline-flex w-fit items-center justify-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
  {
    variants: {
      variant: {
        default:
          'gap-0.5 rounded-full bg-sunken p-[3px] shadow-[inset_0_0_0_1px_var(--line)] group-data-horizontal/tabs:h-10 group-data-vertical/tabs:rounded-2xl',
        line: 'gap-1 border-b border-line group-data-vertical/tabs:border-r group-data-vertical/tabs:border-b-0',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        data-slot="tabs-indicator"
        className={cn(
          'absolute transition-[left,top,width,height] duration-500 ease-glide',
          variant === 'default'
            ? 'top-(--active-tab-top) left-(--active-tab-left) h-(--active-tab-height) w-(--active-tab-width) rounded-full bg-glass-strong shadow-glass-sm'
            : 'bottom-[-1px] left-(--active-tab-left) h-px w-(--active-tab-width) bg-foreground group-data-vertical/tabs:top-(--active-tab-top) group-data-vertical/tabs:right-[-1px] group-data-vertical/tabs:bottom-auto group-data-vertical/tabs:left-auto group-data-vertical/tabs:h-(--active-tab-height) group-data-vertical/tabs:w-px',
        )}
      />
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-full px-3 font-mono text-xs font-medium whitespace-nowrap transition-colors outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:py-2 hover:text-foreground focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        'group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:py-2.5',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
