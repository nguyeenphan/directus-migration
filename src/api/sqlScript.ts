import type { SchemaSnapshotOutput } from '@directus/sdk';
import { readFiles, readRelations, schemaSnapshot } from '@directus/sdk';

import { SYSTEM_COLLECTIONS } from '@/api';
import { AUDIT_FIELDS, KEY_PAGE_SIZE, WRITE_BATCH_SIZE } from '@/constants/run';
import type { TResult, TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import { isEmptyChange, type TDataChange } from '@/models/plan';
import { clientFor, type TDirectusClient } from '@/providers/directusClient';
import { chunkArray } from '@/utils/chunk';
import { withResult } from '@/utils/result';
import { asRows } from '@/utils/rows';

import { fingerprint, orMissing, realColumnsOf } from './data';
import { readAll, readPages } from './paging';

const AUDIT = new Set<string>(AUDIT_FIELDS);

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

export const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
};

export const insertStub = (table: string, primaryKey: string, keys: unknown[]) =>
  `INSERT INTO ${quoteIdent(table)} (${quoteIdent(primaryKey)}) VALUES ${keys
    .map((key) => `(${sqlLiteral(key)})`)
    .join(', ')} ON CONFLICT (${quoteIdent(primaryKey)}) DO NOTHING;`;

export const updateStatement = (
  table: string,
  primaryKey: string,
  columns: string[],
  row: TRow,
) => {
  const assignments = columns
    .filter((col) => col !== primaryKey)
    .map(
      (col) => `${quoteIdent(col)} = ${AUDIT.has(col) ? 'NULL' : sqlLiteral(row[col])}`,
    );

  return (
    `UPDATE ${quoteIdent(table)} SET ${assignments.join(', ')} ` +
    `WHERE ${quoteIdent(primaryKey)} = ${sqlLiteral(row[primaryKey])};`
  );
};

export const insertRow = (
  table: string,
  primaryKey: string,
  columns: string[],
  row: TRow,
) =>
  `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) ` +
  `VALUES (${columns.map((col) => sqlLiteral(row[col])).join(', ')}) ` +
  `ON CONFLICT (${quoteIdent(primaryKey)}) DO NOTHING;`;

export const deleteStatement = (table: string, primaryKey: string, keys: string[]) =>
  `DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent(primaryKey)} IN (${keys
    .map(sqlLiteral)
    .join(', ')});`;

const FILE_COLUMNS = [
  'id',
  'storage',
  'filename_disk',
  'filename_download',
  'title',
  'type',
  'folder',
  'charset',
  'filesize',
  'width',
  'height',
  'metadata',
];

type TCollectionDiff = {
  collection: string;
  primaryKey: string;
  columns: string[];
  newRows: TRow[];
  changedRows: TRow[];
  extraKeys: string[];
};

export const buildSqlScript = (
  source: TConnection,
  target: TConnection,
  rows: TDataChange[],
  selection: ReadonlySet<string>,
  mirrorData: boolean,
): Promise<TResult<string>> =>
  withResult(async () => {
    const from = clientFor(source);
    const to = clientFor(target);

    const snapshot = await from.request(schemaSnapshot());

    const diffs: TCollectionDiff[] = [];

    for (const row of rows) {
      if (!selection.has(row.collection) || isEmptyChange(row)) continue;

      diffs.push(await diffCollection(from, to, snapshot, row, mirrorData));
    }

    const fileRows = await referencedFiles(from, to, diffs);
    const fileStatements = fileRows.map((row) =>
      insertRow(SYSTEM_COLLECTIONS.files, 'id', FILE_COLUMNS, row),
    );

    const stage1 = diffs.flatMap((diff) =>
      diff.newRows.length === 0
        ? []
        : chunkArray(
            diff.newRows.map((row) => row[diff.primaryKey]),
            WRITE_BATCH_SIZE,
          ).map((batch) => insertStub(diff.collection, diff.primaryKey, batch)),
    );

    const stage2 = diffs.flatMap((diff) =>
      [...diff.newRows, ...diff.changedRows].map((row) =>
        updateStatement(diff.collection, diff.primaryKey, diff.columns, row),
      ),
    );

    const stage3 = diffs.flatMap((diff) =>
      diff.extraKeys.length === 0
        ? []
        : [deleteStatement(diff.collection, diff.primaryKey, diff.extraKeys)],
    );

    const sections = [
      section('File metadata (directus_files)', fileStatements),
      section('Stage 1: create missing rows', stage1),
      section('Stage 2: write column values', stage2),
      section('Stage 3: mirror deletes', stage3),
    ].filter((text): text is string => text !== null);

    return sections.length > 0
      ? sections.join('\n\n')
      : '-- No changes for the selected collections.';
  });

const section = (title: string, statements: string[]) =>
  statements.length === 0 ? null : [`-- ${title}`, ...statements].join('\n');

const diffCollection = async (
  from: TDirectusClient,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  row: TDataChange,
  mirrorData: boolean,
): Promise<TCollectionDiff> => {
  const { collection, primaryKey } = row;
  const columns = realColumnsOf(snapshot, collection);

  const sourceRows = await readAll(from, collection, primaryKey, columns);
  const targetRows = (await orMissing(readAll(to, collection, primaryKey, columns))) ?? [];
  const targetByKey = new Map(targetRows.map((item) => [String(item[primaryKey]), item]));

  const newRows: TRow[] = [];
  const changedRows: TRow[] = [];

  for (const sourceRow of sourceRows) {
    const key = String(sourceRow[primaryKey]);
    const targetRow = targetByKey.get(key);

    if (!targetRow) {
      newRows.push(sourceRow);
    } else if (fingerprint(sourceRow) !== fingerprint(targetRow)) {
      changedRows.push(sourceRow);
    }
  }

  let extraKeys: string[] = [];

  if (mirrorData) {
    const sourceKeys = new Set(sourceRows.map((item) => String(item[primaryKey])));
    extraKeys = [...targetByKey.keys()].filter((key) => !sourceKeys.has(key));
  }

  return { collection, primaryKey, columns, newRows, changedRows, extraKeys };
};

const referencedFiles = async (
  from: TDirectusClient,
  to: TDirectusClient,
  diffs: TCollectionDiff[],
): Promise<TRow[]> => {
  const relations = await from.request(readRelations());

  const fileFieldsByCollection = new Map<string, string[]>();

  for (const relation of relations) {
    if (relation.related_collection !== SYSTEM_COLLECTIONS.files) continue;

    const fields = fileFieldsByCollection.get(relation.collection) ?? [];
    fields.push(String(relation.field));
    fileFieldsByCollection.set(relation.collection, fields);
  }

  const referencedIds = new Set<string>();

  for (const diff of diffs) {
    const fields = fileFieldsByCollection.get(diff.collection);
    if (!fields) continue;

    for (const row of [...diff.newRows, ...diff.changedRows]) {
      for (const field of fields) {
        const value = row[field];
        if (typeof value === 'string' && value) referencedIds.add(value);
      }
    }
  }

  if (referencedIds.size === 0) return [];

  const existing = (await orMissing(readFileKeys(to))) ?? new Set<string>();
  const missing = [...referencedIds].filter((id) => !existing.has(id));

  if (missing.length === 0) return [];

  return asRows(
    await from.request<TRow[]>(
      readFiles({
        filter: { id: { _in: missing } },
        limit: missing.length,
        fields: FILE_COLUMNS,
      }),
    ),
  );
};

const readFileKeys = async (client: TDirectusClient) => {
  const rows = await readPages<TRow>(KEY_PAGE_SIZE, (offset) =>
    client.request(
      readFiles({ fields: ['id'], limit: KEY_PAGE_SIZE, offset }),
    ) as Promise<TRow[]>,
  );

  return new Set(rows.map((row) => String(row.id)));
};
