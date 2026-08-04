'use client';

import { ChevronDown, ChevronRight, Search } from 'lucide-react';

import { DiffMark } from '@/components/diffMark';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CHANGE_GLYPH } from '@/constants/changeStyles';
import { SCHEMA_FILTERS } from '@/constants/schema';
import { useSchemaFilter } from '@/hooks/useSchemaFilter';
import { useTranslate } from '@/hooks/useTranslate';
import {
  relationName,
  type TCollectionChange,
  type TSchemaPlan,
} from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  plan: TSchemaPlan;
  selection: Set<string>;
  active: string | null;
  onToggle: (collection: string, isSelected: boolean) => void;
  onInspect: (collection: string) => void;
};

export const SchemaTree = ({
  plan,
  selection,
  active,
  onToggle,
  onInspect,
}: TProps) => {
  const translate = useTranslate();
  const {
    query,
    filter,
    showUnchanged,
    collections,
    relations,
    unchanged,
    setQuery,
    setFilter,
    toggleUnchanged,
  } = useSchemaFilter(plan);

  return (
    <div className="flex h-full min-h-0 flex-col border">
      <header className="flex flex-col gap-2 border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate('schema-search')}
            aria-label={translate('schema-search')}
            className="identifier h-8 pl-7"
          />
        </div>

        <div className="flex gap-1">
          {SCHEMA_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={cn(
                'identifier border px-2 py-0.5 text-xs',
                filter === option
                  ? 'border-foreground bg-accent font-semibold'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {option === 'all'
                ? translate('filter-all')
                : CHANGE_GLYPH[option]}
            </button>
          ))}
        </div>
      </header>

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <Group
          label={translate('schema-collections', { count: collections.length })}
        >
          {collections.map((entry) => (
            <CollectionRow
              key={entry.collection}
              entry={entry}
              isSelected={selection.has(entry.collection)}
              isActive={active === entry.collection}
              onToggle={onToggle}
              onInspect={onInspect}
            />
          ))}
        </Group>

        {relations.length > 0 && (
          <Group
            label={translate('schema-relations', { count: relations.length })}
          >
            {relations.map((relation) => (
              <li
                key={`${relation.collection}.${relation.field}`}
                className="flex items-center gap-2 px-2"
              >
                <span className="w-4" />
                <DiffMark
                  kind={relation.kind}
                  label={translate(`change-${relation.kind}`)}
                />
                <span className="identifier truncate text-muted-foreground">
                  {relationName(relation)}
                </span>
              </li>
            ))}
          </Group>
        )}

        <Group
          label={translate('schema-unchanged', { count: unchanged.length })}
          isCollapsible
          isOpen={showUnchanged}
          onToggle={toggleUnchanged}
        >
          {showUnchanged &&
            unchanged.map((name) => (
              <li key={name} className="flex items-center gap-2 px-2">
                <span className="w-4" />
                <DiffMark
                  kind="unchanged"
                  label={translate('change-unchanged')}
                />
                <span className="identifier truncate text-muted-foreground/70">
                  {name}
                </span>
              </li>
            ))}
        </Group>
      </div>
    </div>
  );
};

const Group = ({
  label,
  isCollapsible = false,
  isOpen = true,
  onToggle,
  children,
}: {
  label: string;
  isCollapsible?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) => (
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

const CollectionRow = ({
  entry,
  isSelected,
  isActive,
  onToggle,
  onInspect,
}: {
  entry: TCollectionChange;
  isSelected: boolean;
  isActive: boolean;
  onToggle: (collection: string, isSelected: boolean) => void;
  onInspect: (collection: string) => void;
}) => {
  const translate = useTranslate();
  const destructive = entry.fields.filter((field) => field.destructive).length;

  return (
    <li
      className={cn(
        'flex items-center gap-2 px-2 hover:bg-accent/60',
        isActive && 'bg-accent',
        !isSelected && 'opacity-40',
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(entry.collection, checked)}
        aria-label={translate('schema-select-one', { name: entry.collection })}
      />
      <DiffMark kind={entry.kind} label={translate(`change-${entry.kind}`)} />

      <button
        type="button"
        onClick={() => onInspect(entry.collection)}
        className="identifier flex-1 truncate text-left hover:underline"
        title={entry.collection}
      >
        {entry.collection}
      </button>

      {entry.fields.length > 0 && (
        <span className="identifier shrink-0 text-xs text-muted-foreground tabular-nums">
          {entry.fields.length}
        </span>
      )}
      {(destructive > 0 || entry.kind === 'delete') && (
        <span
          title={translate('schema-destructive-hint')}
          className="shrink-0 font-bold text-destructive"
        >
          !
        </span>
      )}
    </li>
  );
};
