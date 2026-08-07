'use client';

import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { useTranslate } from '@/hooks/useTranslate';
import { isDeleteOnly, type TDataChange } from '@/models/plan';

import { CollectionGroup } from './collectionGroup';
import { CollectionSearchBar } from './collectionSearchBar';

type TProps = {
  rows: TDataChange[];
  selection: Set<string>;
  mirrorData: boolean;
  active: string | null;

  onToggle: (collections: string[], isSelected: boolean) => void;
  onInspect: (collection: string) => void;
};

export const CollectionList = ({
  rows,
  selection,
  mirrorData,
  active,
  onToggle,
  onInspect,
}: TProps) => {
  const translate = useTranslate();
  const { query, changed, skipped, setQuery, isExpanded, toggleExpand } =
    useCollectionFilter(rows);

  const isInert = (row: TDataChange) => !mirrorData && isDeleteOnly(row);

  return (
    <div className="flex h-full min-h-0 flex-col border">
      <CollectionSearchBar value={query} onChange={setQuery} />

      <ul className="diff-dense min-h-0 flex-1 overflow-y-auto">
        {changed.map((group) => (
          <CollectionGroup
            key={group.parent}
            group={group}
            selection={selection}
            active={active}
            isInert={isInert}
            isOpen={isExpanded(group.parent)}
            onExpand={() => toggleExpand(group.parent)}
            onToggle={onToggle}
            onInspect={onInspect}
          />
        ))}

        {changed.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">
            {translate('data-no-collections')}
          </li>
        )}
      </ul>

      {skipped > 0 && (
        <p className="border-t px-2 py-1.5 text-xs text-muted-foreground/80">
          {translate('data-skipped', { count: skipped })}
        </p>
      )}
    </div>
  );
};
