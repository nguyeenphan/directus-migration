import type { SchemaSnapshotOutput } from '@directus/sdk';
import {
  readFieldsByCollection,
  schemaDiff,
  schemaSnapshot,
} from '@directus/sdk';

import { isSystemName } from '@/api';
import type { TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import {
  META_SCOPES,
  type TChangeKind,
  type TCollectionChange,
  type TCompatibility,
  type TFieldAttributeChange,
  type TMetaDrift,
  type TMetaScope,
  type TRelationChange,
  type TSchemaPlan,
  unknownMetaKeys,
} from '@/models/plan';
import { clientFor, type TDirectusClient } from '@/providers/directusClient';
import { formatValue } from '@/utils/formatValue';

const KIND_BY_DEEP_DIFF: Record<string, TChangeKind> = {
  N: 'add',
  D: 'delete',
  E: 'modify',
  A: 'modify',
};

type TDiffChange = {
  kind?: string;
  path?: unknown[];
  lhs?: unknown;
  rhs?: unknown;

  index?: number;
  item?: { lhs?: unknown; rhs?: unknown };
};

type TDiffEntry = {
  collection?: unknown;
  field?: unknown;
  diff?: TDiffChange[];
};

type TDiffDocument = {
  collections?: TDiffEntry[];
  fields?: TDiffEntry[];
  relations?: TDiffEntry[];
};

export const buildSchemaPlan = async (
  source: TConnection,
  target: TConnection,
  force: boolean,
  onLog?: (line: string) => void,
): Promise<{ plan: TSchemaPlan; snapshot: SchemaSnapshotOutput }> => {
  const from = clientFor(source);
  const to = clientFor(target);

  onLog?.('Taking schema snapshots');
  const [snapshot, targetSnapshot] = await Promise.all([
    from.request(schemaSnapshot()),
    to.request(schemaSnapshot()),
  ]);

  onLog?.('Diffing schemas');
  const { diff } = (await to.request(schemaDiff(snapshot, force))) ?? {
    diff: {},
  };

  const compatibility = compatibilityOf(
    snapshot,
    targetSnapshot,
    await readMetaColumns(to),
  );
  const unknown = unknownMetaKeys(compatibility);

  if (unknown.length > 0) {
    onLog?.(
      `Target does not know ${unknown.length} meta key(s) the source sends: ${unknown.join(', ')}`,
    );
  }

  return {
    plan: assemble(
      stripMetaChanges(diff as TDiffDocument),
      snapshot,
      fieldTypes(targetSnapshot),
      compatibility,
    ),
    snapshot,
  };
};

type TMetaCarrier = { meta?: unknown };

const metaKeysOf = (snapshot: SchemaSnapshotOutput, scope: TMetaScope) => {
  const keys = new Set<string>();

  for (const entry of (snapshot[scope] ?? []) as TMetaCarrier[]) {
    if (!entry?.meta || typeof entry.meta !== 'object') continue;

    for (const key of Object.keys(entry.meta)) keys.add(key);
  }

  return keys;
};

export type TMetaColumns = Record<TMetaScope, Set<string>>;

const SYSTEM_TABLE: Record<TMetaScope, string> = {
  collections: 'directus_collections',
  fields: 'directus_fields',
  relations: 'directus_relations',
};

/**
 * The columns a collection actually has, asked of the instance itself rather
 * than inferred from its content. A fresh install has nothing to infer from,
 * which is precisely when a migration into it needs the answer.
 *
 * An empty set means "could not tell" — callers must treat that as no drift
 * rather than as a collection with no columns.
 */
export const readColumns = async (
  client: TDirectusClient,
  collection: string,
): Promise<Set<string>> => {
  try {
    const fields = await client.request(readFieldsByCollection(collection));

    return new Set(fields.map((entry) => String(entry.field)));
  } catch {
    return new Set<string>();
  }
};

export const readMetaColumns = async (
  client: TDirectusClient,
): Promise<TMetaColumns> => {
  const scopes = await Promise.all(
    META_SCOPES.map(
      async (scope) =>
        [scope, await readColumns(client, SYSTEM_TABLE[scope])] as const,
    ),
  );

  return Object.fromEntries(scopes) as TMetaColumns;
};

/**
 * The names in `wanted` the target has no column for. Unknown columns (an
 * unreadable target) drift by nothing, matching `driftIn`.
 */
export const unknownColumns = (
  wanted: readonly string[],
  known: ReadonlySet<string>,
) => (known.size === 0 ? [] : wanted.filter((name) => !known.has(name)));

export const withoutUnknownKeys = (row: TRow, known: ReadonlySet<string>) =>
  known.size === 0
    ? row
    : Object.fromEntries(
        Object.entries(row).filter(([key]) => known.has(key)),
      );

/**
 * Keys the source will send that the target has no column for. `known` comes
 * from the target's own system tables; sampling its objects is the fallback
 * for when that lookup fails.
 */
const driftIn = (
  source: SchemaSnapshotOutput,
  target: SchemaSnapshotOutput,
  scope: TMetaScope,
  known?: TMetaColumns,
) => {
  const columns = known?.[scope]?.size ? known[scope] : metaKeysOf(target, scope);
  if (columns.size === 0) return [];

  return [...metaKeysOf(source, scope)]
    .filter((key) => !columns.has(key))
    .sort();
};

export const compatibilityOf = (
  source: SchemaSnapshotOutput,
  target: SchemaSnapshotOutput,
  known?: TMetaColumns,
): TCompatibility => ({
  sourceVersion: source.directus ?? 'unknown',
  targetVersion: target.directus ?? 'unknown',

  sourceVendor: source.vendor ?? 'unknown',
  targetVendor: target.vendor ?? 'unknown',

  unknownMeta: Object.fromEntries(
    META_SCOPES.map((scope) => [scope, driftIn(source, target, scope, known)]),
  ) as TMetaDrift,
});

const withoutKeys = (meta: Record<string, unknown>, drop: ReadonlySet<string>) =>
  Object.fromEntries(
    Object.entries(meta).filter(([key]) => !drop.has(key)),
  );

const prunedChange = (change: TDiffChange, drop: ReadonlySet<string>) => {
  const rhs = change.rhs as { meta?: Record<string, unknown> } | undefined;
  if (!rhs?.meta || typeof rhs.meta !== 'object') return change;

  return { ...change, rhs: { ...rhs, meta: withoutKeys(rhs.meta, drop) } };
};

/**
 * Newly created objects carry their whole `meta` over, so a key the target has
 * no column for reaches the insert and fails it. Meta-only edits on objects
 * that already exist are dropped earlier, by `stripMetaChanges`.
 */
export const pruneUnknownMeta = (
  diff: TDiffDocument,
  unknownMeta: TMetaDrift,
): TDiffDocument => {
  const pruned = { ...diff };

  for (const scope of META_SCOPES) {
    const drop = new Set(unknownMeta[scope]);
    if (drop.size === 0) continue;

    pruned[scope] = (diff[scope] ?? []).map((entry) => ({
      ...entry,
      diff: (entry.diff ?? []).map((change) => prunedChange(change, drop)),
    }));
  }

  return pruned;
};

const fieldTypes = (snapshot: SchemaSnapshotOutput) => {
  const types = new Map<string, string>();

  for (const field of snapshot.fields) {
    types.set(`${field.collection}.${field.field}`, renderType(field));
  }

  return types;
};

const renderType = (field: {
  type?: string;
  schema?: { data_type?: string; max_length?: number | null } | null;
}) => {
  const base = field.schema?.data_type ?? field.type ?? 'unknown';
  const length = field.schema?.max_length;

  return length ? `${base}(${length})` : base;
};

const assemble = (
  diff: TDiffDocument,
  snapshot: SchemaSnapshotOutput,
  targetTypes: Map<string, string>,
  compatibility: TCompatibility,
): TSchemaPlan => {
  const sourceTypes = fieldTypes(snapshot);
  const byCollection = new Map<string, TCollectionChange>();

  const entryFor = (collection: string) => {
    const existing = byCollection.get(collection);
    if (existing) return existing;

    const created: TCollectionChange = {
      collection,
      kind: 'modify',
      fields: [],
      dependents: [],
    };
    byCollection.set(collection, created);
    return created;
  };

  for (const entry of diff.collections ?? []) {
    const collection = String(entry.collection ?? '');
    if (!collection) continue;

    entryFor(collection).kind = kindOfEntry(entry);
  }

  for (const entry of diff.fields ?? []) {
    const collection = String(entry.collection ?? '');
    const field = String(entry.field ?? '');
    if (!collection || !field) continue;

    const kind = kindOfEntry(entry);
    const key = `${collection}.${field}`;

    entryFor(collection).fields.push({
      field,
      kind,
      sourceType: sourceTypes.get(key) ?? null,
      targetType: targetTypes.get(key) ?? null,
      attributes: kind === 'modify' ? attributeChanges(entry) : [],
      destructive: isDestructive(kind, entry),
    });
  }

  const relations: TRelationChange[] = (diff.relations ?? []).map((entry) => ({
    kind: kindOfEntry(entry),
    collection: String(entry.collection ?? ''),
    field: String(entry.field ?? ''),
    relatedCollection: relatedCollectionOf(snapshot, entry),
  }));

  const collections = [...byCollection.values()];
  attachDependents(collections, snapshot);

  const touched = new Set(collections.map((entry) => entry.collection));
  const unchanged = snapshot.collections
    .map((entry) => String(entry.collection))
    .filter((name) => !isSystemName(name) && !touched.has(name));

  return { collections, relations, unchanged, compatibility };
};

export const attributeChanges = (entry: TDiffEntry): TFieldAttributeChange[] =>
  (entry.diff ?? [])
    .filter((change) => change.kind !== 'N' && change.kind !== 'D')
    .map((change) => {
      const path = (change.path ?? []).map(String).join('.');
      const label =
        change.index === undefined ? path : `${path}[${change.index}]`;

      const { lhs, rhs } =
        change.item && change.index !== undefined ? change.item : change;

      return {
        path: label || 'schema',
        before: formatValue(lhs),
        after: formatValue(rhs),
      };
    })

    .filter((change) => change.before !== null || change.after !== null);

const isWholeObject = (change: TDiffChange) =>
  change.path === undefined || change.path.length === 0;

export const kindOfEntry = (entry: TDiffEntry): TChangeKind => {
  const whole = (entry.diff ?? []).find(isWholeObject);
  if (!whole) return 'modify';

  return KIND_BY_DEEP_DIFF[String(whole.kind ?? 'E')] ?? 'modify';
};

const isMetaOnly = (change: TDiffChange) =>
  !isWholeObject(change) && change.path?.[0] === 'meta';

const withoutMeta = (entries: TDiffEntry[] = []): TDiffEntry[] =>
  entries
    .map((entry) => ({
      ...entry,
      diff: (entry.diff ?? []).filter((change) => !isMetaOnly(change)),
    }))
    .filter((entry) => entry.diff.length > 0);

export const stripMetaChanges = (diff: TDiffDocument): TDiffDocument => ({
  ...diff,
  collections: withoutMeta(diff.collections),
  fields: withoutMeta(diff.fields),
  relations: withoutMeta(diff.relations),
});

export const onlyCollections = (
  diff: TDiffDocument,
  keep: ReadonlySet<string>,
): TDiffDocument => {
  const kept = (entries: TDiffEntry[] = []) =>
    entries.filter((entry) => keep.has(String(entry.collection ?? '')));

  return {
    ...diff,
    collections: kept(diff.collections),
    fields: kept(diff.fields),
    relations: kept(diff.relations),
  };
};

const NARROWING_KEYS = ['data_type', 'max_length', 'numeric_precision'];

const isDestructive = (kind: TChangeKind, entry: TDiffEntry) => {
  if (kind === 'delete') return true;

  return (entry.diff ?? []).some((change) =>
    (change.path ?? []).some(
      (segment) =>
        typeof segment === 'string' && NARROWING_KEYS.includes(segment),
    ),
  );
};

const relatedCollectionOf = (
  snapshot: SchemaSnapshotOutput,
  entry: TDiffEntry,
) => {
  const match = snapshot.relations.find(
    (relation) =>
      relation.collection === entry.collection &&
      relation.field === entry.field,
  );

  return match?.related_collection ?? null;
};

const attachDependents = (
  collections: TCollectionChange[],
  snapshot: SchemaSnapshotOutput,
) => {
  const dependents = new Map<string, Set<string>>();

  for (const relation of snapshot.relations) {
    const to = relation.related_collection;
    const from = relation.collection;
    if (!to || !from || to === from) continue;

    const set = dependents.get(to) ?? new Set<string>();
    set.add(from);
    dependents.set(to, set);
  }

  for (const entry of collections) {
    entry.dependents = [...(dependents.get(entry.collection) ?? [])].sort();
  }
};
