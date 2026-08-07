'use client';

import { DiffMark } from '@/components/common/diffMark';
import { useSchemaFilter } from '@/hooks/useSchemaFilter';
import { useTranslate } from '@/hooks/useTranslate';
import { relationName, type TSchemaPlan } from '@/models/plan';

import { SchemaCollectionRow } from './schemaCollectionRow';
import { SchemaFilterBar } from './schemaFilterBar';
import { SchemaGroup } from './schemaGroup';

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
      <SchemaFilterBar
        query={query}
        filter={filter}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
      />

      <div className="diff-dense min-h-0 flex-1 overflow-y-auto">
        <SchemaGroup
          label={translate('schema-collections', { count: collections.length })}
        >
          {collections.map((entry) => (
            <SchemaCollectionRow
              key={entry.collection}
              entry={entry}
              isSelected={selection.has(entry.collection)}
              isActive={active === entry.collection}
              onToggle={onToggle}
              onInspect={onInspect}
            />
          ))}
        </SchemaGroup>

        {relations.length > 0 && (
          <SchemaGroup
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
          </SchemaGroup>
        )}

        <SchemaGroup
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
        </SchemaGroup>
      </div>
    </div>
  );
};
