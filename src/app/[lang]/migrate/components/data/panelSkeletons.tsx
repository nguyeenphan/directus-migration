'use client';

import { Skeleton } from '@/components/ui/skeleton';

type TProps = {
  /** Announced to screen readers in place of the glyph texture. */
  label: string;
};

/**
 * Stand-ins for the three data panels while they load. Each keeps its panel's
 * frame and the list's 28px row rhythm, so nothing jumps when the real rows
 * land; the drifting ░▒ texture comes from <Skeleton>.
 *
 * ponytail: plain skeletons, not <AsciiReveal loading>. AsciiReveal churns the
 * text already on screen and puts back the text it saw when loading started —
 * right for a refresh that returns the same text, wrong here, where a recompare
 * or another collection replaces it.
 */
const WIDTHS = [
  'w-48',
  'w-64',
  'w-40',
  'w-56',
  'w-44',
  'w-60',
  'w-36',
  'w-52',
  'w-44',
  'w-64',
];

// ponytail: more 28px rows than any panel is tall, clipped by overflow-hidden,
// rather than measuring the panel to count them. Raise it if a display ever
// goes past ~1800px of panel height.
const ROWS = Array.from({ length: 64 }, (_, index) => ({
  index,
  width: WIDTHS[index % WIDTHS.length],
}));

const Panel = ({ label, children }: TProps & { children: React.ReactNode }) => (
  <div
    aria-busy
    className="flex h-full min-h-0 flex-col rounded-md border bg-card"
  >
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

export const CollectionListSkeleton = ({ label }: TProps) => (
  <Panel label={label}>
    <header className="border-b p-2">
      <Skeleton className="h-8 w-full" />
    </header>

    <div className="min-h-0 flex-1 overflow-hidden">
      {ROWS.map((row) => (
        <div key={row.index} className="flex h-7 items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className={`h-3 ${row.width}`} />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  </Panel>
);

export const RecordListSkeleton = ({ label }: TProps) => (
  <Panel label={label}>
    <div className="flex items-center gap-2 border-b px-2 py-1.5">
      <Skeleton className="size-4 rounded-sm" />
      <Skeleton className="h-3 w-28" />
      <Skeleton className="ml-auto h-3 w-10" />
    </div>

    <div className="min-h-0 flex-1 overflow-hidden">
      {ROWS.map((row) => (
        <div key={row.index} className="flex h-7 items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="size-3 rounded-sm" />
          <Skeleton className={`h-3 ${row.width}`} />
        </div>
      ))}
    </div>
  </Panel>
);

export const RecordDetailSkeleton = ({ label }: TProps) => (
  <Panel label={label}>
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <Skeleton className="size-4 rounded-sm" />
      <Skeleton className="h-4 w-44" />
      <Skeleton className="ml-auto h-3 w-16" />
    </div>

    <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">
      {ROWS.map((row) => (
        <div key={row.index} className="flex h-7 items-center gap-3">
          <Skeleton className="h-3 w-32 shrink-0" />
          <Skeleton className={`h-3 ${row.width}`} />
        </div>
      ))}
    </div>
  </Panel>
);
