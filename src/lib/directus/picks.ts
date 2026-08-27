import type { SchemaSnapshotOutput } from '@directus/sdk';

import { isSystemName } from '@/constants/directus';
import type { TRow } from '@/models/common';
import { pickedKeys, type TRecordPicks } from '@/models/plan';

export type TPickRelation = {
  collection: string;
  field: string;
  related: string;
};

export const foreignKeysOf = (
  snapshot: SchemaSnapshotOutput,
): TPickRelation[] =>
  snapshot.relations
    .filter((relation) => relation.related_collection)
    .filter((relation) => !isSystemName(String(relation.related_collection)))
    .filter((relation) => !isSystemName(String(relation.collection)))
    .map((relation) => ({
      collection: String(relation.collection),
      field: String(relation.field),
      related: String(relation.related_collection),
    }));

type TExpansion = {
  picks: TRecordPicks;

  pulled: Record<string, number>;
};

export const expandPicks = ({
  picks,
  relations,
  rows,
  primaryKeys,
  inTarget,
}: {
  picks: TRecordPicks;
  relations: TPickRelation[];

  rows: Map<string, TRow[]>;
  primaryKeys: Map<string, string>;
  inTarget?: Map<string, ReadonlySet<string>>;
}): TExpansion => {
  const keep = new Map<string, Set<string> | null>();
  const available = new Map<string, Set<string>>();

  const keyOf = (collection: string, row: TRow) =>
    String(row[primaryKeys.get(collection) ?? 'id']);

  for (const [collection, list] of rows) {
    keep.set(collection, pickedKeys(picks, collection));
    available.set(
      collection,
      new Set(list.map((row) => keyOf(collection, row))),
    );
  }

  const pulled: Record<string, number> = {};

  const wanted = relations.filter(
    (relation) => rows.has(relation.collection) && keep.get(relation.related),
  );

  let changed = true;

  while (changed) {
    changed = false;

    for (const relation of wanted) {
      const childRows = rows.get(relation.collection) ?? [];
      const childKeep = keep.get(relation.collection);

      const parentKeep = keep.get(relation.related);
      if (!parentKeep) continue;

      const parentRows = available.get(relation.related) ?? new Set<string>();
      const parentInTarget = inTarget?.get(relation.related);

      for (const row of childRows) {
        if (childKeep && !childKeep.has(keyOf(relation.collection, row))) {
          continue;
        }

        const value = row[relation.field];
        if (value === null || value === undefined) continue;

        const key = String(value);

        if (
          parentKeep.has(key) ||
          !parentRows.has(key) ||
          parentInTarget?.has(key)
        ) {
          continue;
        }

        parentKeep.add(key);
        pulled[relation.related] = (pulled[relation.related] ?? 0) + 1;
        changed = true;
      }
    }
  }

  const expanded: TRecordPicks = { ...picks };

  for (const [collection, kept] of keep) {
    if (kept) expanded[collection] = [...kept];
  }

  return { picks: expanded, pulled };
};

export const pulledSummary = (pulled: Record<string, number>) =>
  Object.entries(pulled)
    .map(([collection, count]) => `${collection} (${count})`)
    .join(', ');
