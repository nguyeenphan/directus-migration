'use client';

import { CountChip } from '@/components/common/countChip';
import { useTranslate } from '@/hooks/useTranslate';
import type { groupTotals } from '@/models/plan';

export type TTotals = ReturnType<typeof groupTotals>;

type TProps = {
  totals: TTotals;
};

export const CollectionCounts = ({ totals }: TProps) => {
  const translate = useTranslate();

  return (
    <span className="flex shrink-0 gap-1 text-xs">
      <CountChip
        kind="add"
        value={totals.toCreate}
        label={translate('count-to-create')}
        className="min-w-10"
      />
      <CountChip
        kind="modify"
        value={totals.updateUnknown ? null : totals.toUpdate}
        label={translate('count-to-update')}
        className="min-w-10"
      />
      <CountChip
        kind="delete"
        value={totals.extraInTarget}
        label={translate('count-extra')}
        className="min-w-10"
      />
    </span>
  );
};
