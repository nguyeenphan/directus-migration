import { ChangeIcon } from '@/components/common/changeIcon';
import { CHANGE_TEXT } from '@/constants/changeStyles';
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
      'inline-flex w-3.5 shrink-0 items-center justify-center select-none',
      CHANGE_TEXT[kind],
      className,
    )}
  >
    <ChangeIcon kind={kind} />
    <span className="sr-only">{label}</span>
  </span>
);
