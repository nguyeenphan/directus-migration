import { CHANGE_GLYPH, CHANGE_TEXT, NOTHING } from '@/constants/changeStyles';
import type { TChangeKind } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  kind: TChangeKind;

  value: number | null;
  label: string;
  className?: string;
};

export const CountChip = ({ kind, value, label, className }: TProps) => {
  const isEmpty = value === 0;

  return (
    <span
      title={label}
      className={cn(
        'identifier inline-flex min-w-14 items-center justify-end gap-1 tabular-nums',
        isEmpty ? 'text-muted-foreground/40' : CHANGE_TEXT[kind],
        className,
      )}
    >
      <span aria-hidden>{CHANGE_GLYPH[kind]}</span>
      {value === null ? NOTHING : value}
    </span>
  );
};
