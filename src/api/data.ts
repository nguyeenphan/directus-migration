import type { SchemaSnapshotOutput } from '@directus/sdk';
import { readItems } from '@directus/sdk';

import { isSystemName, SYSTEM_COLLECTIONS } from '@/api';
import {
  AUDIT_FIELDS,
  COMPARE_PAGE_SIZE,
  PROTECTED_COLLECTIONS,
} from '@/constants/run';
import type { TConnection } from '@/models/connection';
import { findParent, type TDataChange } from '@/models/plan';
import { clientFor, type TDirectusClient } from '@/providers/directusClient';
import { asRows } from '@/utils/rows';

import { readAll } from './paging';

export const buildDataPlan = async (
  source: TConnection,
  target: TConnection,
  snapshot: SchemaSnapshotOutput,
  addedCollections: ReadonlySet<string>,
  onLog?: (line: string) => void,
): Promise<TDataChange[]> => {
  const from = clientFor(source);
  const to = clientFor(target);

  const collections = migratableCollections(snapshot);

  const changes: TDataChange[] = [];

  for (const [index, collection] of collections.entries()) {
    onLog?.(`Comparing ${collection} (${index + 1}/${collections.length})`);

    const primaryKey = primaryKeyOf(snapshot, collection);

    changes.push({
      ...(await compareCollection({
        from,
        to,
        collection,
        primaryKey,
        columns: realColumnsOf(snapshot, collection),
        isSingleton: isSingletonCollection(snapshot, collection),
        targetMissing: addedCollections.has(collection),
        allCollections: collections,
      })),
      primaryKey,
      hasAutoIncrement: hasAutoIncrementKey(snapshot, collection),
    });
  }

  return changes;
};

export const migratableCollections = (snapshot: SchemaSnapshotOutput) => {
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

export const hasAutoIncrementKey = (
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

export const isMissingCollection = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;

  const { errors, response } = error as {
    errors?: { extensions?: { code?: string } }[];
    response?: { status?: number };
  };

  return (
    response?.status === 403 || errors?.[0]?.extensions?.code === 'FORBIDDEN'
  );
};

export const orMissing = async <T>(promise: Promise<T>): Promise<T | null> => {
  try {
    return await promise;
  } catch (error) {
    if (isMissingCollection(error)) return null;
    throw error;
  }
};

type TCompared = Omit<TDataChange, 'primaryKey' | 'hasAutoIncrement'>;

const compareCollection = async ({
  from,
  to,
  collection,
  primaryKey,
  columns,
  isSingleton,
  targetMissing,
  allCollections,
}: {
  from: TDirectusClient;
  to: TDirectusClient;
  collection: string;
  primaryKey: string;
  columns: string[];
  isSingleton: boolean;
  targetMissing: boolean;
  allCollections: string[];
}): Promise<TCompared> => {
  const parent = findParent(collection, allCollections);

  if (isSingleton) {
    return compareSingleton({
      from,
      to,
      collection,
      parent,
      primaryKey,
      columns,
    });
  }

  const sourceRows = await readFingerprints(
    from,
    collection,
    primaryKey,
    columns,
  );

  const targetRows = targetMissing
    ? null
    : await orMissing(readFingerprints(to, collection, primaryKey, columns));

  if (!targetRows) {
    return {
      collection,
      parent,
      toCreate: sourceRows.size,
      toUpdate: 0,
      extraInTarget: 0,
    };
  }

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

  return { collection, parent, toCreate, toUpdate, extraInTarget };
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
      .map(([field, value]) => [field, value ?? null]),
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
