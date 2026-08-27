import type { SchemaSnapshotOutput } from '@directus/sdk';
import { schemaDiff, schemaSnapshot } from '@directus/sdk';

import { clientFor } from '@/lib/directus/client';
import type { TResult, TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import { unknownMetaKeys } from '@/models/plan';
import { withResult } from '@/utils/result';

import {
  compatibilityOf,
  onlyCollections,
  pruneUnknownMeta,
  readMetaColumns,
  stripMetaChanges,
} from './schema';
import { quoteIdent, sqlLiteral } from './sqlScript';

const META_TABLE = {
  collections: 'directus_collections',
  fields: 'directus_fields',
  relations: 'directus_relations',
} as const;

type TColumnSchema = {
  data_type?: string | null;
  default_value?: unknown;
  max_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  is_nullable?: boolean;
  is_unique?: boolean;
  is_primary_key?: boolean;
  has_auto_increment?: boolean;
};

type TRelationSchema = {
  constraint_name?: string | null;
  foreign_key_table?: string | null;
  foreign_key_column?: string | null;
  on_delete?: string | null;
  on_update?: string | null;
};

type TObject = {
  collection?: unknown;
  field?: unknown;
  meta?: Record<string, unknown> | null;
  schema?: (TColumnSchema & TRelationSchema) | null;
};

type TDiffChange = { kind?: string; path?: unknown[]; rhs?: unknown };

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

const wholeAdd = (entry: TDiffEntry): TObject | null => {
  const change = (entry.diff ?? []).find(
    (item) => (item.path ?? []).length === 0 && item.kind === 'N',
  );

  return (change?.rhs as TObject | undefined) ?? null;
};

const isAdd = (entry: TDiffEntry) => wholeAdd(entry) !== null;

const isDrop = (entry: TDiffEntry) =>
  (entry.diff ?? []).some(
    (item) => (item.path ?? []).length === 0 && item.kind === 'D',
  );

const EXPRESSION = /\(\s*\)\s*$/;

export const columnType = (schema: TColumnSchema) => {
  const type = schema.data_type ?? 'text';

  if (schema.has_auto_increment) {
    return type.includes('big') ? 'bigserial' : 'serial';
  }

  if (schema.max_length && schema.max_length > 0) {
    return `${type}(${schema.max_length})`;
  }

  if (schema.numeric_precision && type.match(/numeric|decimal/)) {
    return `${type}(${schema.numeric_precision}, ${schema.numeric_scale ?? 0})`;
  }

  return type;
};

const columnDefinition = (field: TObject) => {
  const schema = field.schema;
  if (!schema?.data_type && !schema?.has_auto_increment) return null;

  const parts = [quoteIdent(String(field.field)), columnType(schema)];

  if (schema.is_nullable === false || schema.is_primary_key) {
    parts.push('NOT NULL');
  }

  if (schema.is_unique && !schema.is_primary_key) parts.push('UNIQUE');

  const fallback = schema.default_value;

  if (
    fallback !== null &&
    fallback !== undefined &&
    !schema.has_auto_increment
  ) {
    parts.push(
      `DEFAULT ${
        typeof fallback === 'string' && EXPRESSION.test(fallback)
          ? fallback
          : sqlLiteral(fallback)
      }`,
    );
  }

  return parts.join(' ');
};

export const createTable = (collection: string, fields: TObject[]) => {
  const columns = fields
    .map(columnDefinition)
    .filter((line): line is string => line !== null);

  if (columns.length === 0) return null;

  const primaryKeys = fields
    .filter((field) => field.schema?.is_primary_key)
    .map((field) => quoteIdent(String(field.field)));

  const body = [
    ...columns,
    ...(primaryKeys.length > 0
      ? [`PRIMARY KEY (${primaryKeys.join(', ')})`]
      : []),
  ];

  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(collection)} (\n  ${body.join(
    ',\n  ',
  )}\n);`;
};

export const addColumn = (field: TObject) => {
  const definition = columnDefinition(field);
  if (!definition) return null;

  return (
    `ALTER TABLE ${quoteIdent(String(field.collection))} ` +
    `ADD COLUMN IF NOT EXISTS ${definition};`
  );
};

export const addForeignKey = (relation: TObject) => {
  const schema = relation.schema;
  if (!schema?.foreign_key_table || !schema.foreign_key_column) return null;

  const table = String(relation.collection);
  const column = String(relation.field);
  const name = schema.constraint_name ?? `${table}_${column}_foreign`;

  const clauses = [
    `ALTER TABLE ${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(name)}`,
    `FOREIGN KEY (${quoteIdent(column)})`,
    `REFERENCES ${quoteIdent(schema.foreign_key_table)} ` +
      `(${quoteIdent(schema.foreign_key_column)})`,
    ...(schema.on_delete ? [`ON DELETE ${schema.on_delete}`] : []),
    ...(schema.on_update ? [`ON UPDATE ${schema.on_update}`] : []),
  ];

  return `${clauses.join(' ')};`;
};

const CSV_COLUMNS = new Set(['special', 'one_allowed_collections']);

const metaLiteral = (column: string, value: unknown) =>
  CSV_COLUMNS.has(column) && Array.isArray(value)
    ? sqlLiteral(value.join(','))
    : sqlLiteral(value);

export const insertMetaRow = (table: string, meta: TRow) => {
  const columns = Object.keys(meta).filter((key) => key !== 'id');
  if (columns.length === 0) return null;

  return (
    `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) ` +
    `VALUES (${columns.map((key) => metaLiteral(key, meta[key])).join(', ')}) ` +
    `ON CONFLICT DO NOTHING;`
  );
};

const section = (title: string, statements: (string | null)[]) => {
  const lines = statements.filter((line): line is string => line !== null);
  return lines.length === 0 ? null : [`-- ${title}`, ...lines].join('\n');
};

export const renderSchemaSql = (
  diff: TDiffDocument,
  onLog?: (line: string) => void,
) => {
  const newCollections = (diff.collections ?? []).filter(isAdd);
  const newNames = new Set(
    newCollections.map((entry) => String(entry.collection)),
  );

  const newFields = (diff.fields ?? [])
    .map(wholeAdd)
    .filter((field): field is TObject => field !== null);

  const fieldsOf = (collection: string) =>
    newFields.filter((field) => String(field.collection) === collection);

  const names = [...newNames];

  const tables = names.map((collection, index) => {
    onLog?.(`Creating ${collection} (${index + 1}/${names.length})`);

    return createTable(collection, fieldsOf(collection));
  });

  const tableless = names.filter(
    (collection) => createTable(collection, fieldsOf(collection)) === null,
  );

  const columns = newFields
    .filter((field) => !newNames.has(String(field.collection)))
    .map((field) => {
      onLog?.(`Adding ${String(field.collection)}.${String(field.field)}`);

      return addColumn(field);
    });

  const newRelations = (diff.relations ?? [])
    .map(wholeAdd)
    .filter((relation): relation is TObject => relation !== null);

  const meta = [
    ...newCollections
      .map(wholeAdd)
      .map((entry) =>
        entry?.meta ? insertMetaRow(META_TABLE.collections, entry.meta) : null,
      ),

    ...newFields.map((field) =>
      field.meta ? insertMetaRow(META_TABLE.fields, field.meta) : null,
    ),

    ...newRelations.map((relation) =>
      relation.meta ? insertMetaRow(META_TABLE.relations, relation.meta) : null,
    ),
  ];

  const unsupported = [
    ...tableless.map(
      (collection) =>
        `--   ${collection} — new, but the diff carries no columns for it`,
    ),
    ...[
      ...(diff.collections ?? []),
      ...(diff.fields ?? []),
      ...(diff.relations ?? []),
    ]
      .filter((entry) => !isAdd(entry))
      .map(
        (entry) =>
          `--   ${String(entry.collection)}${
            entry.field ? `.${String(entry.field)}` : ''
          } — ${
            isDrop(entry) ? 'removed in the source' : 'changed in the source'
          }`,
      ),
  ];

  return [
    unsupported.length > 0
      ? [
          '-- WARNING: not everything is written as SQL. Review by hand:',
          ...unsupported,
        ].join('\n')
      : null,

    section('Stage 1: create tables', tables),
    section('Stage 2: add columns', columns),
    section('Stage 3: foreign keys', newRelations.map(addForeignKey)),
    section('Stage 4: Directus metadata', meta),
  ].filter((text): text is string => text !== null);
};

export const buildSchemaSqlScript = (
  source: TConnection,
  target: TConnection,
  force: boolean,
  selection: ReadonlySet<string>,
  onLog?: (line: string) => void,
): Promise<TResult<string>> =>
  withResult(async () => {
    const from = clientFor(source);
    const to = clientFor(target);

    onLog?.('Taking a schema snapshot');
    const snapshot: SchemaSnapshotOutput = await from.request(schemaSnapshot());

    onLog?.('Diffing schemas');
    const diff = await to.request(schemaDiff(snapshot, force));

    if (!diff?.hash) return '-- Schema already matches — nothing to apply.';

    onLog?.('Checking which meta columns the target has');
    const compatibility = compatibilityOf(
      snapshot,
      await to.request(schemaSnapshot()),
      await readMetaColumns(to),
    );

    const unknown = unknownMetaKeys(compatibility);

    const structural = onlyCollections(
      pruneUnknownMeta(
        stripMetaChanges(diff.diff as never),
        compatibility.unknownMeta,
      ),
      selection,
    ) as TDiffDocument;

    const sections = [
      ...(unknown.length > 0
        ? [
            `-- WARNING: the target (${compatibility.targetVersion}) has no ` +
              `column for ${unknown.join(', ')}. Those values are omitted.`,
          ]
        : []),
      ...renderSchemaSql(structural, onLog),
    ];

    return sections.length > 0
      ? sections.join('\n\n')
      : '-- No changes for the selected collections.';
  });
