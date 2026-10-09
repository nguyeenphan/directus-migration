import { CHANGE_ICON } from '@/constants/changeStyles';
import type { TChangeKind } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  kind: TChangeKind;
  className?: string;
};

export const ChangeIcon = ({ kind, className }: TProps) => {
  const Icon = CHANGE_ICON[kind];

  return <Icon aria-hidden className={cn('size-3.5 shrink-0', className)} />;
};
