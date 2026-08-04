'use client';

import { ChevronDown, ChevronRight, Search } from 'lucide-react';

import { CountChip } from '@/components/countChip';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { useTranslate } from '@/hooks/useTranslate';
import {
  groupTotals,
  type TCollectionGroup,
  type TDataChange,
} from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  rows: TDataChange[];
  selection: Set<string>;
  active: string | null;

  onToggle: (collections: string[], isSelected: boolean) => void;
  onInspect: (collection: string) => void;
};

const groupMembers = (group: TCollectionGroup) => [
  ...(group.own ? [group.own.collection] : []),
  ...group.derived.map((row) => row.collection),
];

export const CollectionList = ({
  rows,
  selection,
  active,
  onToggle,
  onInspect,
}: TProps) => {
  const translate = useTranslate();
  const { query, changed, skipped, setQuery, isExpanded, toggleExpand } =
    useCollectionFilter(rows);

  return (
    <div className="flex h-full min-h-0 flex-col border">
      <header className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate('data-search')}
            aria-label={translate('data-search')}
            className="identifier h-8 pl-7"
          />
        </div>
      </header>

      <ul className="diff-dense min-h-0 flex-1 overflow-y-auto">
        {changed.map((group) => {
          const totals = groupTotals(group);
          const isOpen = isExpanded(group.parent);

          return (
            <li key={group.parent}>
              <div
                className={cn(
                  'group flex items-center gap-1 px-2 hover:bg-accent/60',
                  active === group.parent && 'bg-accent',
                  !groupMembers(group).some((name) => selection.has(name)) &&
                    'opacity-40',
                )}
              >
                <Checkbox
                  checked={groupMembers(group).every((name) =>
                    selection.has(name),
                  )}
                  onCheckedChange={(checked) =>
                    onToggle(groupMembers(group), checked)
                  }
                  aria-label={translate('data-select-one', {
                    name: group.parent,
                  })}
                  className="opacity-0 transition-none group-hover:opacity-100 data-checked:opacity-100"
                />

                {group.derived.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.parent)}
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
                ) : (
                  <span className="w-3.5" />
                )}

                <button
                  type="button"
                  onClick={() => onInspect(group.parent)}
                  className="identifier min-w-0 flex-1 truncate text-left hover:underline"
                  title={group.parent}
                >
                  {group.parent}
                </button>

                <Counts totals={totals} />
              </div>

              {isOpen &&
                group.derived.map((row) => (
                  <div
                    key={row.collection}
                    className={cn(
                      'group flex items-center gap-1 py-0 pl-2 pr-2 hover:bg-accent/60',
                      active === row.collection && 'bg-accent',
                      !selection.has(row.collection) && 'opacity-40',
                    )}
                  >
                    <Checkbox
                      checked={selection.has(row.collection)}
                      onCheckedChange={(checked) =>
                        onToggle([row.collection], checked)
                      }
                      aria-label={translate('data-select-one', {
                        name: row.collection,
                      })}
                      className="opacity-0 transition-none group-hover:opacity-100 data-checked:opacity-100"
                    />
                    <span className="w-3.5" />
                    <button
                      type="button"
                      onClick={() => onInspect(row.collection)}
                      className="identifier min-w-0 flex-1 truncate pl-4 text-left text-xs text-muted-foreground hover:text-foreground hover:underline"
                      title={row.collection}
                    >
                      {row.collection}
                    </button>
                    <Counts
                      totals={{
                        toCreate: row.toCreate,
                        toUpdate: row.toUpdate ?? 0,
                        updateUnknown: row.toUpdate === null,
                        extraInTarget: row.extraInTarget,
                      }}
                    />
                  </div>
                ))}
            </li>
          );
        })}

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

const Counts = ({ totals }: { totals: ReturnType<typeof groupTotals> }) => {
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
