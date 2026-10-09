import {
  readFieldsByCollection,
  readFiles,
  readItems,
  readRelations,
} from '@directus/sdk';

import { SYSTEM_COLLECTIONS } from '@/constants/directus';
import {
  AUDIT_FIELDS,
  ID_FILTER_SIZE,
  MAX_DETAIL_RECORDS,
} from '@/constants/run';
import { clientFor, type TDirectusClient } from '@/lib/directus/client';
import type { TResult, TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import type {
  TChangeKind,
  TFieldValue,
  TRecordChange,
  TValueDisplay,
} from '@/models/plan';
import { chunkArray } from '@/utils/chunk';
import { formatValue, isSameValue, recordLabel } from '@/utils/formatValue';
import { withResult } from '@/utils/result';
import { asRows } from '@/utils/rows';

import { orMissing } from './errors';
import { readAll } from './paging';
import { readColumns, unknownColumns } from './schema';

type TFieldShape = {
  field: string;
  display: TValueDisplay;

  relatedCollection: string | null;
  audit: boolean;
};

const AUDIT = new Set<string>(AUDIT_FIELDS);

export const getRecordChanges = (
  source: TConnection,
  target: TConnection,
  collection: string,
): Promise<TResult<TRecordChange[]>> =>
  withResult(async () => {
    const from = clientFor(source);
    const to = clientFor(target);

    const [fields, known] = await Promise.all([
      from.request(readFieldsByCollection(collection)),
      readColumns(to, collection),
    ]);
    const primaryKey = primaryKeyOfFields(fields);
    const columns = columnsOfFields(fields);

    const missing = unknownColumns(columns, known);
    const usable = columns.filter((name) => !missing.includes(name));
    const shared = usable.length > 0 ? usable : columns;

    const [shapes, sourceRows, targetRows] = await Promise.all([
      readShapes(from, collection, fields),
      readRows(from, collection, primaryKey, shared),
      readTargetRows(to, collection, primaryKey, shared),
    ]);

    const changes = compare(
      shapes.filter((shape) => !missing.includes(shape.field)),
      primaryKey,
      sourceRows,
      targetRows,
    ).slice(0, MAX_DETAIL_RECORDS);

    await resolveLabels(from, to, shapes, changes);

    return changes;
  });

type TFieldDefinition = {
  field?: unknown;
  schema?: unknown;
  meta?: { hidden?: boolean | null; interface?: string | null } | null;
  type?: string;
};

const primaryKeyOfFields = (fields: TFieldDefinition[]) => {
  const primary = fields.find(
    (field) =>
      (field.schema as { is_primary_key?: boolean } | null)?.is_primary_key,
  );

  return primary ? String(primary.field) : 'id';
};

const columnsOfFields = (fields: TFieldDefinition[]) => {
  const columns = fields
    .filter((field) => field.schema)
    .map((field) => String(field.field));

  return columns.length > 0 ? columns : [primaryKeyOfFields(fields)];
};

const readRows = (
  client: TDirectusClient,
  collection: string,
  primaryKey: string,
  columns: string[],
) => readAll(client, collection, primaryKey, columns);

const readTargetRows = async (
  client: TDirectusClient,
  collection: string,
  primaryKey: string,
  columns: string[],
) => (await orMissing(readRows(client, collection, primaryKey, columns))) ?? [];

const compare = (
  shapes: TFieldShape[],
  primaryKey: string,
  sourceRows: TRow[],
  targetRows: TRow[],
): TRecordChange[] => {
  const byKey = new Map(
    targetRows.map((row) => [String(row[primaryKey]), row]),
  );
  const changes: TRecordChange[] = [];

  for (const row of sourceRows) {
    const key = String(row[primaryKey]);
    const existing = byKey.get(key);

    if (!existing) {
      changes.push({
        key,
        kind: 'add',
        label: recordLabel(row, key),
        fields: describeFields(shapes, {}, row),
      });
      continue;
    }

    const fields = describeFields(shapes, existing, row);
    if (fields.every((field) => field.kind === 'unchanged')) continue;

    changes.push({
      key,
      kind: conflicts(existing, row) ? 'conflict' : 'modify',
      label: recordLabel(row, key),
      fields,
    });
  }

  const sourceKeys = new Set(sourceRows.map((row) => String(row[primaryKey])));

  for (const row of targetRows) {
    const key = String(row[primaryKey]);
    if (sourceKeys.has(key)) continue;

    changes.push({
      key,
      kind: 'delete',
      label: recordLabel(row, key),
      fields: describeFields(shapes, row, {}),
    });
  }

  return changes;
};

const conflicts = (target: TRow, source: TRow) => {
  const targetAt = target.date_updated;
  const sourceAt = source.date_updated;

  return (
    typeof targetAt === 'string' &&
    typeof sourceAt === 'string' &&
    targetAt > sourceAt
  );
};

const describeFields = (
  shapes: TFieldShape[],
  target: TRow,
  source: TRow,
): TFieldValue[] =>
  shapes.map((shape) => {
    const before = target[shape.field];
    const after = source[shape.field];
    const kind: TChangeKind = isSameValue(before, after)
      ? 'unchanged'
      : 'modify';

    return {
      field: shape.field,
      kind,
      display: shape.display,

      before: formatValue(before),
      after: formatValue(after),
      beforeRef: null,
      afterRef: null,
      audit: shape.audit,
    };
  });

const readShape = async (client: TDirectusClient, collection: string) => {
  const fields = await client.request(readFieldsByCollection(collection));

  return {
    primaryKey: primaryKeyOfFields(fields),
    columns: columnsOfFields(fields),
  };
};

const RICH_TEXT_INTERFACES = [
  'rich-text',
  'block-editor',
  'markdown',
  'wysiwyg',
];

const readShapes = async (
  client: TDirectusClient,
  collection: string,
  fields: TFieldDefinition[],
): Promise<TFieldShape[]> => {
  const relations = await client.request(readRelations());

  const relatedBy = new Map(
    relations
      .filter((relation) => relation.collection === collection)
      .map((relation) => [
        String(relation.field),
        relation.related_collection ?? null,
      ]),
  );

  return fields
    .filter((field) => !field.meta?.hidden)
    .map((field) => {
      const name = String(field.field);
      const related = relatedBy.get(name) ?? null;

      return {
        field: name,
        display: displayOf(field, related),
        relatedCollection: related,
        audit: AUDIT.has(name),
      };
    });
};

const displayOf = (
  field: { type?: string; meta?: { interface?: string | null } | null },
  relatedCollection: string | null,
): TValueDisplay => {
  if (relatedCollection === SYSTEM_COLLECTIONS.files) return 'file';
  if (relatedCollection) return 'relation';

  const interfaceName = field.meta?.interface ?? '';
  const isRich = RICH_TEXT_INTERFACES.some((name) =>
    interfaceName.includes(name),
  );

  return isRich || field.type === 'text' ? 'longtext' : 'scalar';
};

const resolveLabels = async (
  from: TDirectusClient,
  to: TDirectusClient,
  shapes: TFieldShape[],
  changes: TRecordChange[],
) => {
  const referencing = new Map(
    shapes
      .filter(
        (shape) => shape.display === 'file' || shape.display === 'relation',
      )
      .map((shape) => [shape.field, shape]),
  );
  if (referencing.size === 0) return;

  const wanted = new Map<string, Set<string>>();

  for (const change of changes) {
    for (const field of change.fields) {
      const shape = referencing.get(field.field);
      if (!shape?.relatedCollection) continue;

      const ids = wanted.get(shape.relatedCollection) ?? new Set<string>();
      if (field.before) ids.add(field.before);
      if (field.after) ids.add(field.after);
      wanted.set(shape.relatedCollection, ids);
    }
  }

  const labels = new Map<string, string>();

  await Promise.all(
    [...wanted].map(async ([collection, ids]) => {
      for (const client of [from, to]) {
        for (const [id, label] of await labelsFor(client, collection, [
          ...ids,
        ])) {
          if (!labels.has(`${collection}:${id}`)) {
            labels.set(`${collection}:${id}`, label);
          }
        }
      }
    }),
  );

  for (const change of changes) {
    for (const field of change.fields) {
      const shape = referencing.get(field.field);
      if (!shape?.relatedCollection) continue;

      field.beforeRef = field.before;
      field.afterRef = field.after;
      field.before = decorate(labels, shape.relatedCollection, field.before);
      field.after = decorate(labels, shape.relatedCollection, field.after);
    }
  }
};

const decorate = (
  labels: Map<string, string>,
  collection: string,
  id: string | null,
) => (id === null ? null : (labels.get(`${collection}:${id}`) ?? id));

// In slices: every id rides in the query string, and a few hundred uuids
// make a URL the server refuses.
const labelsFor = async (
  client: TDirectusClient,
  collection: string,
  ids: string[],
): Promise<[string, string][]> =>
  (
    await Promise.all(
      chunkArray(ids, ID_FILTER_SIZE).map((slice) =>
        labelsForSlice(client, collection, slice),
      ),
    )
  ).flat();

const labelsForSlice = async (
  client: TDirectusClient,
  collection: string,
  ids: string[],
): Promise<[string, string][]> => {
  if (ids.length === 0) return [];

  // Files live behind /files, not /items — readItems would 403 on them and the
  // label would fall back to the bare uuid.
  if (collection === SYSTEM_COLLECTIONS.files) {
    try {
      const rows = asRows(
        await client.request<TRow[]>(
          readFiles({
            filter: { id: { _in: ids } },
            limit: ids.length,
            fields: ['id', 'filename_disk', 'filename_download', 'title'],
          }),
        ),
      );

      return rows.map((row) => {
        const id = String(row.id);
        const disk = row.filename_disk;

        return [id, typeof disk === 'string' ? disk : recordLabel(row, id)];
      });
    } catch {
      return [];
    }
  }

  try {
    const { primaryKey, columns } = await readShape(client, collection);
    const rows = asRows(
      await client.request<TRow[]>(
        readItems(collection, {
          filter: { [primaryKey]: { _in: ids } },
          limit: ids.length,
          fields: columns,
        }),
      ),
    );

    return rows.map((row) => {
      const id = String(row[primaryKey]);
      return [id, recordLabel(row, id)];
    });
  } catch {
    return [];
  }
};
