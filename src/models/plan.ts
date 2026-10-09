import { SCHEMA_FILTERS } from '@/constants/schema';
import { compareVersions } from '@/utils/version';

import type { TSequenceReset } from './run';

export type TChangeKind =
  'add' | 'modify' | 'delete' | 'unchanged' | 'conflict' | 'blocked';
export type TSchemaFilter = (typeof SCHEMA_FILTERS)[number];

export type TFieldAttributeChange = {
  path: string;
  before: string | null;
  after: string | null;
};

export type TFieldChange = {
  field: string;
  kind: TChangeKind;

  sourceType: string | null;
  targetType: string | null;

  attributes: TFieldAttributeChange[];

  destructive: boolean;
};

export type TCollectionChange = {
  collection: string;
  kind: TChangeKind;
  fields: TFieldChange[];

  dependents: string[];
};

export type TRelationChange = {
  kind: TChangeKind;
  collection: string;
  field: string;
  relatedCollection: string | null;
};

export type TMetaScope = 'collections' | 'fields' | 'relations';

export type TMetaDrift = Record<TMetaScope, string[]>;

export type TCompatibility = {
  sourceVersion: string;
  targetVersion: string;

  sourceVendor: string;
  targetVendor: string;

  unknownMeta: TMetaDrift;
};

export type TSchemaPlan = {
  collections: TCollectionChange[];
  relations: TRelationChange[];

  unchanged: string[];

  compatibility: TCompatibility;
};

export const META_SCOPES: TMetaScope[] = ['collections', 'fields', 'relations'];

export const unknownMetaKeys = (compatibility: TCompatibility) =>
  META_SCOPES.flatMap((scope) => compatibility.unknownMeta[scope]);

export const hasVersionMismatch = (compatibility: TCompatibility) =>
  compareVersions(compatibility.sourceVersion, compatibility.targetVersion) !==
  'same';

export const hasVendorMismatch = (compatibility: TCompatibility) =>
  compatibility.sourceVendor !== compatibility.targetVendor;

export const isIncompatible = (compatibility: TCompatibility) =>
  hasVersionMismatch(compatibility) ||
  hasVendorMismatch(compatibility) ||
  unknownMetaKeys(compatibility).length > 0;

export const relationName = (relation: TRelationChange) =>
  `${relation.collection} → ${relation.relatedCollection ?? relation.field}`;

export const destructiveChanges = (plan: TSchemaPlan) =>
  plan.collections.filter(
    (entry) =>
      entry.kind === 'delete' ||
      entry.fields.some((field) => field.destructive),
  );

export const strandedBy = (
  plan: TSchemaPlan,
  selected: ReadonlySet<string>,
): { missing: string; needed: string[] }[] => {
  const byMissing = new Map<string, string[]>();

  for (const entry of plan.collections) {
    if (selected.has(entry.collection)) continue;

    const needy = entry.dependents.filter((name) => selected.has(name));
    if (needy.length > 0) byMissing.set(entry.collection, needy);
  }

  return [...byMissing].map(([missing, needed]) => ({ missing, needed }));
};

export type TDataChange = {
  collection: string;

  parent: string | null;
  toCreate: number;

  toUpdate: number | null;

  extraInTarget: number;

  primaryKey: string;
  hasAutoIncrement: boolean;

  dependsOn?: string[];
};

export const missingDependencies = (
  rows: TDataChange[],
  selection: ReadonlySet<string>,
): { collection: string; missing: string[] }[] => {
  const byName = new Map(rows.map((row) => [row.collection, row]));

  return rows
    .filter((row) => selection.has(row.collection))
    .map((row) => ({
      collection: row.collection,
      missing: (row.dependsOn ?? []).filter((name) => {
        if (selection.has(name)) return false;

        const parent = byName.get(name);
        return !parent || parent.toCreate > 0;
      }),
    }))
    .filter((entry) => entry.missing.length > 0);
};

export const sequenceResetsIn = (
  rows: TDataChange[],
  selection: ReadonlySet<string>,
): TSequenceReset[] =>
  rows
    .filter((row) => row.hasAutoIncrement && selection.has(row.collection))
    .map(({ collection, primaryKey }) => ({ collection, primaryKey }));

export type TValueDisplay = 'scalar' | 'longtext' | 'file' | 'relation';

export type TFieldValue = {
  field: string;

  kind: TChangeKind;
  display: TValueDisplay;

  before: string | null;

  after: string | null;

  beforeRef: string | null;
  afterRef: string | null;
  audit: boolean;
};

export type TRecordChange = {
  key: string;
  kind: TChangeKind;

  label: string;
  fields: TFieldValue[];
};

export const changedFields = (record: TRecordChange) =>
  record.fields
    .filter((field) => field.kind === 'modify' && !field.audit)
    .map((field) => field.field);

export const isAuditOnly = (record: TRecordChange) =>
  record.kind === 'modify' &&
  record.fields.some((field) => field.kind === 'modify') &&
  changedFields(record).length === 0;

export type TPlan = {
  generatedAt: string;
  schema: TSchemaPlan;
  data: TDataChange[];
};

export const isDeleteOnly = (row: TDataChange) =>
  row.toCreate === 0 && (row.toUpdate ?? 0) === 0 && row.extraInTarget > 0;

export const isEmptyChange = (row: TDataChange) =>
  row.toCreate === 0 && row.extraInTarget === 0 && (row.toUpdate ?? 0) === 0;

export const findParent = (
  collection: string,
  all: string[],
): string | null => {
  const candidates = all.filter(
    (other) => other !== collection && collection.startsWith(`${other}_`),
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((shortest, other) =>
    other.length < shortest.length ? other : shortest,
  );
};

export type TCollectionGroup = {
  parent: string;

  own: TDataChange | null;
  derived: TDataChange[];
};

export const groupCollections = (rows: TDataChange[]): TCollectionGroup[] => {
  const groups = new Map<string, TCollectionGroup>();

  const groupFor = (parent: string) => {
    const existing = groups.get(parent);
    if (existing) return existing;

    const created: TCollectionGroup = { parent, own: null, derived: [] };
    groups.set(parent, created);
    return created;
  };

  for (const row of rows) {
    const group = groupFor(row.parent ?? row.collection);
    if (row.parent) group.derived.push(row);
    else group.own = row;
  }

  return [...groups.values()];
};

export const groupTotals = (group: TCollectionGroup) =>
  [group.own, ...group.derived]
    .filter((row): row is TDataChange => row !== null)
    .reduce(
      (total, row) => ({
        toCreate: total.toCreate + row.toCreate,
        toUpdate: total.toUpdate + (row.toUpdate ?? 0),

        updateUnknown: total.updateUnknown || row.toUpdate === null,
        extraInTarget: total.extraInTarget + row.extraInTarget,
      }),
      { toCreate: 0, toUpdate: 0, updateUnknown: false, extraInTarget: 0 },
    );

/**
 * The records the user unticked, by collection. Everything not named here
 * travels — including records the review list never showed, because it is
 * capped and skips hidden fields. An allow-list would silently drop those.
 */
export type TRecordExclusions = Record<string, string[]>;

const NOTHING_EXCLUDED: ReadonlySet<string> = new Set();

export const excludedKeys = (
  exclusions: TRecordExclusions | undefined,
  collection: string,
): ReadonlySet<string> => {
  const keys = exclusions?.[collection];
  return keys && keys.length > 0 ? new Set(keys) : NOTHING_EXCLUDED;
};

export const keepsRow = (excluded: ReadonlySet<string>, key: unknown) =>
  !excluded.has(String(key));
