import type { SchemaSnapshotOutput } from '@directus/sdk';

import { isSystemName } from '@/constants/directus';
import type { TRow } from '@/models/common';
import type { TRecordExclusions } from '@/models/plan';

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
  excluded: TRecordExclusions;

  pulled: Record<string, number>;
};

/**
 * An unticked record that a travelling record points at has to travel too, or
 * the target rejects the foreign key. Such records are taken back out of the
 * exclusions, hop after hop, unless the target already holds them.
 */
export const pullReferenced = ({
  excluded,
  relations,
  rows,
  primaryKeys,
  inTarget,
}: {
  excluded: TRecordExclusions;
  relations: TPickRelation[];

  rows: Map<string, TRow[]>;
  primaryKeys: Map<string, string>;
  inTarget?: Map<string, ReadonlySet<string>>;
}): TExpansion => {
  const left = new Map<string, Set<string>>();
  const available = new Map<string, Set<string>>();

  const keyOf = (collection: string, row: TRow) =>
    String(row[primaryKeys.get(collection) ?? 'id']);

  for (const [collection, list] of rows) {
    left.set(collection, new Set(excluded[collection] ?? []));
    available.set(
      collection,
      new Set(list.map((row) => keyOf(collection, row))),
    );
  }

  const pulled: Record<string, number> = {};

  const wanted = relations.filter(
    (relation) =>
      rows.has(relation.collection) &&
      (left.get(relation.related)?.size ?? 0) > 0,
  );

  let changed = true;

  while (changed) {
    changed = false;

    for (const relation of wanted) {
      const childLeft = left.get(relation.collection);
      const parentLeft = left.get(relation.related);
      if (!parentLeft || parentLeft.size === 0) continue;

      const parentRows = available.get(relation.related);
      const parentInTarget = inTarget?.get(relation.related);

      for (const row of rows.get(relation.collection) ?? []) {
        if (childLeft?.has(keyOf(relation.collection, row))) continue;

        const value = row[relation.field];
        if (value === null || value === undefined) continue;

        const key = String(value);

        if (
          !parentLeft.has(key) ||
          !parentRows?.has(key) ||
          parentInTarget?.has(key)
        ) {
          continue;
        }

        parentLeft.delete(key);
        pulled[relation.related] = (pulled[relation.related] ?? 0) + 1;
        changed = true;
      }
    }
  }

  const expanded: TRecordExclusions = { ...excluded };

  for (const [collection, keys] of left) {
    if (keys.size > 0) expanded[collection] = [...keys];
    else delete expanded[collection];
  }

  return { excluded: expanded, pulled };
};

export const pulledSummary = (pulled: Record<string, number>) =>
  Object.entries(pulled)
    .map(([collection, count]) => `${collection} (${count})`)
    .join(', ');
