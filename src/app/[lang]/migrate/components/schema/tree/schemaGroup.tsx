'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

type TProps = {
  label: string;
  isCollapsible?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children: ReactNode;
};

export const SchemaGroup = ({
  label,
  isCollapsible = false,
  isOpen = true,
  onToggle,
  children,
}: TProps) => (
  <section>
    <h3 className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {isCollapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex items-center gap-1 hover:text-foreground"
        >
          {isOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          {label}
        </button>
      ) : (
        <>
          <span className="w-3.5" />
          {label}
        </>
      )}
    </h3>
    <ul>{children}</ul>
  </section>
);
