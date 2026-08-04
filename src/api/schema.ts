import type { SchemaSnapshotOutput } from '@directus/sdk';
import { schemaDiff, schemaSnapshot } from '@directus/sdk';

import { isSystemName } from '@/api';
import type { TConnection } from '@/models/connection';
import type {
  TChangeKind,
  TCollectionChange,
  TFieldAttributeChange,
  TRelationChange,
  TSchemaPlan,
} from '@/models/plan';
import { clientFor } from '@/providers/directusClient';
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

  return {
    plan: assemble(
      stripMetaChanges(diff as TDiffDocument),
      snapshot,
      fieldTypes(targetSnapshot),
    ),
    snapshot,
  };
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

  return { collections, relations, unchanged };
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
