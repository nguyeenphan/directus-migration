'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';

import { useTranslate } from '@/hooks/useTranslate';
import {
  groupTotals,
  type TCollectionGroup,
  type TDataChange,
} from '@/models/plan';

import type { TTotals } from './collectionCounts';
import { CollectionRow } from './collectionRow';

type TProps = {
  group: TCollectionGroup;
  selection: Set<string>;
  active: string | null;
  isOpen: boolean;

  isInert: (row: TDataChange) => boolean;
  onExpand: () => void;
  onToggle: (collections: string[], isSelected: boolean) => void;
  onInspect: (collection: string) => void;
};

const groupMembers = (group: TCollectionGroup): TDataChange[] => [
  ...(group.own ? [group.own] : []),
  ...group.derived,
];

const rowTotals = (row: TDataChange): TTotals => ({
  toCreate: row.toCreate,
  toUpdate: row.toUpdate ?? 0,
  updateUnknown: row.toUpdate === null,
  extraInTarget: row.extraInTarget,
});

export const CollectionGroup = ({
  group,
  selection,
  active,
  isOpen,
  isInert,
  onExpand,
  onToggle,
  onInspect,
}: TProps) => {
  const translate = useTranslate();

  const members = groupMembers(group);
  const selectable = members
    .filter((row) => !isInert(row))
    .map((row) => row.collection);
  const groupInert = selectable.length === 0;

  return (
    <li>
      <CollectionRow
        name={group.parent}
        totals={groupTotals(group)}
        checked={!groupInert && selectable.every((name) => selection.has(name))}
        disabled={groupInert}
        dimmed={!members.some((row) => selection.has(row.collection))}
        active={active === group.parent}
        onToggle={(checked) => onToggle(selectable, checked)}
        onInspect={() => onInspect(group.parent)}
      >
        {group.derived.length > 0 ? (
          <button
            type="button"
            onClick={onExpand}
            aria-expanded={isOpen}
            aria-label={translate('data-toggle-derived', {
              name: group.parent,
              count: group.derived.length,
            })}
            className="text-muted-foreground hover:text-foreground"
          >
            {isOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : null}
      </CollectionRow>

      {isOpen &&
        group.derived.map((row) => (
          <CollectionRow
            key={row.collection}
            name={row.collection}
            totals={rowTotals(row)}
            checked={!isInert(row) && selection.has(row.collection)}
            disabled={isInert(row)}
            dimmed={!selection.has(row.collection)}
            active={active === row.collection}
            nested
            onToggle={(checked) => onToggle([row.collection], checked)}
            onInspect={() => onInspect(row.collection)}
          />
        ))}
    </li>
  );
};
