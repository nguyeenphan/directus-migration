import { CHANGE_GLYPH, CHANGE_TEXT } from '@/constants/changeStyles';
import type { TChangeKind } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  kind: TChangeKind;

  label: string;
  className?: string;
};

export const DiffMark = ({ kind, label, className }: TProps) => (
  <span
    className={cn(
      'identifier inline-block w-3 shrink-0 text-center font-bold select-none',
      CHANGE_TEXT[kind],
      className,
    )}
  >
    <span aria-hidden>{CHANGE_GLYPH[kind]}</span>
    <span className="sr-only">{label}</span>
  </span>
);
