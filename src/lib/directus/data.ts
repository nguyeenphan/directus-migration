import type { SchemaSnapshotOutput } from '@directus/sdk';
import { readItems } from '@directus/sdk';

import { isSystemName, SYSTEM_COLLECTIONS } from '@/constants/directus';
import {
  AUDIT_FIELDS,
  COMPARE_PAGE_SIZE,
  PROTECTED_COLLECTIONS,
} from '@/constants/run';
import { clientFor, type TDirectusClient } from '@/lib/directus/client';
import type { TConnection } from '@/models/connection';
import { findParent, isEmptyChange, type TDataChange } from '@/models/plan';
import { canonicalValue } from '@/utils/formatValue';
import { asRows } from '@/utils/rows';

import { orMissing } from './errors';
import { readAll, readKeys } from './paging';
import { readColumns, unknownColumns } from './schema';

export const buildDataPlan = async (
  source: TConnection,
  target: TConnection,
  snapshot: SchemaSnapshotOutput,
  onLog?: (line: string) => void,
): Promise<TDataChange[]> => {
  const from = clientFor(source);
  const to = clientFor(target);

  const collections = migratableCollections(snapshot);
  const dependencies = dependencyMap(snapshot, collections);

  const changes: TDataChange[] = [];

  for (const [index, collection] of collections.entries()) {
    onLog?.(`Comparing ${collection} (${index + 1}/${collections.length})`);

    const primaryKey = primaryKeyOf(snapshot, collection);

    const compared = await compareCollection({
      from,
      to,
      collection,
      primaryKey,
      columns: realColumnsOf(snapshot, collection),
      isSingleton: isSingletonCollection(snapshot, collection),
      allCollections: collections,
      onLog,
    });

    const { sourceCount, targetCount, ...counts } = compared;

    const change: TDataChange = {
      ...counts,
      primaryKey,
      hasAutoIncrement: hasAutoIncrementKey(snapshot, collection),
      dependsOn: dependencies.get(collection) ?? [],
    };

    if (!isEmptyChange(change)) {
      onLog?.(
        `${collection}: read ${sourceCount} from the source and ` +
          `${targetCount ?? 'nothing'} from the target — ` +
          `+${change.toCreate} ~${change.toUpdate ?? '?'} ` +
          `-${change.extraInTarget}`,
      );
    }

    changes.push(change);
  }

  return changes;
};

const dependencyMap = (
  snapshot: SchemaSnapshotOutput,
  collections: string[],
) => {
  const known = new Set(collections);
  const parents = new Map<string, Set<string>>();

  for (const relation of snapshot.relations) {
    const child = String(relation.collection);
    const parent = relation.related_collection
      ? String(relation.related_collection)
      : null;

    if (!parent || parent === child) continue;
    if (parent === SYSTEM_COLLECTIONS.files) continue;
    if (!known.has(child) || !known.has(parent)) continue;

    parents.set(child, (parents.get(child) ?? new Set()).add(parent));
  }

  return new Map(
    [...parents].map(([child, names]) => [child, [...names].sort()]),
  );
};

const migratableCollections = (snapshot: SchemaSnapshotOutput) => {
  const protectedNames = new Set<string>(PROTECTED_COLLECTIONS);

  return snapshot.collections
    .map((entry) => String(entry.collection))
    .filter((name) => !protectedNames.has(name))
    .filter((name) => !isSystemName(name) || name === SYSTEM_COLLECTIONS.files)
    .sort();
};

export const primaryKeyOf = (
  snapshot: SchemaSnapshotOutput,
  collection: string,
) => {
  const match = snapshot.fields.find(
    (field) => field.collection === collection && field.schema?.is_primary_key,
  );

  return match ? String(match.field) : 'id';
};

const hasAutoIncrementKey = (
  snapshot: SchemaSnapshotOutput,
  collection: string,
) =>
  snapshot.fields.some(
    (field) =>
      field.collection === collection &&
      field.schema?.is_primary_key &&
      field.schema.has_auto_increment === true,
  );

export const isSingletonCollection = (
  snapshot: SchemaSnapshotOutput,
  collection: string,
) =>
  snapshot.collections.some(
    (entry) =>
      entry.collection === collection && entry.meta?.singleton === true,
  );

export const realColumnsOf = (
  snapshot: SchemaSnapshotOutput,
  collection: string,
): string[] => {
  const columns = snapshot.fields
    .filter((field) => field.collection === collection && field.schema)
    .map((field) => String(field.field));

  return columns.length > 0 ? columns : [primaryKeyOf(snapshot, collection)];
};

type TCompared = Omit<TDataChange, 'primaryKey' | 'hasAutoIncrement'> & {
  sourceCount: number;
  targetCount: number | null;
};

/**
 * Both sides have to be read through the same columns, or their fingerprints
 * never line up. A column the target lacks also makes Directus refuse the
 * whole read with FORBIDDEN, which would otherwise be mistaken for a missing
 * collection and report every record as new.
 */
const sharedColumns = async (
  to: TDirectusClient,
  collection: string,
  columns: string[],
  onLog?: (line: string) => void,
) => {
  const known = await readColumns(to, collection);
  const missing = unknownColumns(columns, known);

  if (missing.length === 0) return columns;

  onLog?.(
    `${collection}: the target has no column for ${missing.join(', ')} — ` +
      `comparing on the rest`,
  );

  const shared = columns.filter((name) => !missing.includes(name));
  return shared.length > 0 ? shared : columns;
};

/**
 * The fallback for a target that answers for its keys but not for its columns
 * — a column the source has and it does not makes Directus refuse the whole
 * read. Keys still say which records are missing; nothing can be said about
 * the ones both sides hold, so `toUpdate` stays unknown.
 */
const compareKeysOnly = async ({
  to,
  collection,
  parent,
  primaryKey,
  sourceKeys,
  onLog,
}: {
  to: TDirectusClient;
  collection: string;
  parent: string | null;
  primaryKey: string;
  sourceKeys: ReadonlySet<string>;
  onLog?: (line: string) => void;
}): Promise<TCompared> => {
  const targetKeys = await orMissing(readKeys(to, collection, primaryKey));

  if (!targetKeys) {
    onLog?.(
      `${collection}: the target has nothing to read — every record counts as new`,
    );

    return {
      collection,
      parent,
      toCreate: sourceKeys.size,
      toUpdate: 0,
      extraInTarget: 0,
      sourceCount: sourceKeys.size,
      targetCount: null,
    };
  }

  onLog?.(
    `${collection}: the target refused a full read — comparing keys only`,
  );

  return {
    collection,
    parent,
    toCreate: [...sourceKeys].filter((key) => !targetKeys.has(key)).length,
    toUpdate: null,
    extraInTarget: [...targetKeys].filter((key) => !sourceKeys.has(key)).length,
    sourceCount: sourceKeys.size,
    targetCount: targetKeys.size,
  };
};

const compareCollection = async ({
  from,
  to,
  collection,
  primaryKey,
  columns,
  isSingleton,
  allCollections,
  onLog,
}: {
  from: TDirectusClient;
  to: TDirectusClient;
  collection: string;
  primaryKey: string;
  columns: string[];
  isSingleton: boolean;
  allCollections: string[];
  onLog?: (line: string) => void;
}): Promise<TCompared> => {
  const parent = findParent(collection, allCollections);
  const shared = await sharedColumns(to, collection, columns, onLog);

  if (isSingleton) {
    return compareSingleton({
      from,
      to,
      collection,
      parent,
      primaryKey,
      columns: shared,
    });
  }

  const sourceRows = await readFingerprints(
    from,
    collection,
    primaryKey,
    shared,
  );

  const targetRows = await orMissing(
    readFingerprints(to, collection, primaryKey, shared),
  );

  if (!targetRows)
    return await compareKeysOnly({
      to,
      collection,
      parent,
      primaryKey,
      sourceKeys: new Set(sourceRows.keys()),
      onLog,
    });

  let toCreate = 0;
  let toUpdate = 0;

  for (const [key, fingerprint] of sourceRows) {
    const onTarget = targetRows.get(key);

    if (onTarget === undefined) toCreate += 1;
    else if (onTarget !== fingerprint) toUpdate += 1;
  }

  let extraInTarget = 0;
  for (const key of targetRows.keys()) {
    if (!sourceRows.has(key)) extraInTarget += 1;
  }

  return {
    collection,
    parent,
    toCreate,
    toUpdate,
    extraInTarget,
    sourceCount: sourceRows.size,
    targetCount: targetRows.size,
  };
};

const compareSingleton = async ({
  from,
  to,
  collection,
  parent,
  primaryKey,
  columns,
}: {
  from: TDirectusClient;
  to: TDirectusClient;
  collection: string;
  parent: string | null;
  primaryKey: string;
  columns: string[];
}): Promise<TCompared> => {
  const [source, target] = await Promise.all([
    readSingletonRow(from, collection, columns),
    orMissing(readSingletonRow(to, collection, columns)),
  ]);

  const empty = {
    collection,
    parent,
    toCreate: 0,
    toUpdate: 0,
    extraInTarget: 0,
    sourceCount: source ? 1 : 0,
    targetCount: target ? 1 : null,
  };

  if (!source) return empty;
  if (!target) return { ...empty, toCreate: 1 };

  const without = (row: Record<string, unknown>) => {
    const rest = { ...row };
    delete rest[primaryKey];
    return fingerprint(rest);
  };

  return { ...empty, toUpdate: without(source) === without(target) ? 0 : 1 };
};

const readSingletonRow = async (
  client: TDirectusClient,
  collection: string,
  columns: string[],
) => {
  const [row] = asRows<Record<string, unknown>>(
    await client.request<Record<string, unknown>>(
      readItems(collection, { fields: columns, limit: 1 }),
    ),
  );

  if (!row || Object.values(row).every((value) => value === null)) return null;

  return row;
};

export const fingerprint = (row: Record<string, unknown>): string => {
  const audit = new Set<string>(AUDIT_FIELDS);

  return JSON.stringify(
    Object.entries(row)
      .filter(([field]) => !audit.has(field))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([field, value]) => [field, canonicalValue(value)]),
  );
};

const readFingerprints = async (
  client: TDirectusClient,
  collection: string,
  primaryKey: string,
  columns: string[],
) => {
  const rows = await readAll(
    client,
    collection,
    primaryKey,
    columns,
    COMPARE_PAGE_SIZE,
  );

  const keys = new Map<string, string>();

  for (const row of rows) {
    const key = row[primaryKey];

    if (key === null || key === undefined) continue;

    keys.set(String(key), fingerprint(row));
  }

  return keys;
};
