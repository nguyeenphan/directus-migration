import { AUDIT_FIELDS } from '@/constants/run';
import { SCHEMA_FILTERS } from '@/constants/schema';

import type { TSequenceReset } from './run';

export type TChangeKind =
  'add' | 'modify' | 'delete' | 'unchanged' | 'conflict' | 'blocked';

export const isActionable = (kind: TChangeKind) =>
  kind === 'add' || kind === 'modify' || kind === 'delete';

export type TSchemaFilter = (typeof SCHEMA_FILTERS)[number];

export type TSchemaObject = 'collection' | 'field' | 'relation';

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

export type TSchemaPlan = {
  collections: TCollectionChange[];
  relations: TRelationChange[];

  unchanged: string[];
};

export const relationName = (relation: TRelationChange) =>
  `${relation.collection}→${relation.relatedCollection ?? relation.field}`;

export const schemaChangeCount = (plan: TSchemaPlan) =>
  plan.collections.filter((entry) => entry.kind !== 'unchanged').length +
  plan.relations.length;

export const destructiveChanges = (plan: TSchemaPlan) => [
  ...plan.collections.filter((entry) => entry.kind === 'delete'),
  ...plan.collections.filter((entry) =>
    entry.fields.some((field) => field.destructive),
  ),
];

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

export const AUDIT_FIELD_SET: ReadonlySet<string> = new Set(AUDIT_FIELDS);

export type TPlan = {
  generatedAt: string;
  schema: TSchemaPlan;
  data: TDataChange[];
};

export const isDeleteOnly = (row: TDataChange) =>
  row.toCreate === 0 && (row.toUpdate ?? 0) === 0 && row.extraInTarget > 0;

export const isEmptyChange = (row: TDataChange) =>
  row.toCreate === 0 && row.extraInTarget === 0 && (row.toUpdate ?? 0) === 0;

export const isEmptyPlan = (plan: TPlan) =>
  schemaChangeCount(plan.schema) === 0 && plan.data.every(isEmptyChange);

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
