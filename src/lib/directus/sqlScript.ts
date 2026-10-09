import type { SchemaSnapshotOutput } from '@directus/sdk';
import {
  readFiles,
  readFolders,
  readRelations,
  schemaSnapshot,
} from '@directus/sdk';

import { SYSTEM_COLLECTIONS } from '@/constants/directus';
import {
  AUDIT_FIELDS,
  COMPARE_CONCURRENCY,
  ID_FILTER_SIZE,
  KEY_PAGE_SIZE,
  WRITE_BATCH_SIZE,
} from '@/constants/run';
import { clientFor, type TDirectusClient } from '@/lib/directus/client';
import type { TResult, TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import {
  excludedKeys,
  isEmptyChange,
  type TDataChange,
  type TRecordExclusions,
} from '@/models/plan';
import { chunkArray } from '@/utils/chunk';
import { mapLimit } from '@/utils/concurrency';
import { withResult } from '@/utils/result';
import { asRows } from '@/utils/rows';

import {
  diffRows,
  fingerprint,
  isSingletonCollection,
  realColumnsOf,
} from './data';
import { orMissing } from './errors';
import { inParentOrder } from './folders';
import { readAll, readPages } from './paging';
import { foreignKeysOf, pullReferenced } from './picks';
import { readColumns, unknownColumns } from './schema';

const AUDIT = new Set<string>(AUDIT_FIELDS);

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

export const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'NULL';

  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
};

export const insertStub = (
  table: string,
  primaryKey: string,
  keys: unknown[],
) =>
  `INSERT INTO ${quoteIdent(table)} (${quoteIdent(primaryKey)}) VALUES ${keys
    .map((key) => `(${sqlLiteral(key)})`)
    .join(', ')} ON CONFLICT (${quoteIdent(primaryKey)}) DO NOTHING;`;

const assignmentsOf = (primaryKey: string, columns: string[], row: TRow) =>
  columns
    .filter((col) => col !== primaryKey)
    .map(
      (col) =>
        `${quoteIdent(col)} = ${AUDIT.has(col) ? 'NULL' : sqlLiteral(row[col])}`,
    );

export const updateStatement = (
  table: string,
  primaryKey: string,
  columns: string[],
  row: TRow,
) => {
  const assignments = assignmentsOf(primaryKey, columns, row);
  if (assignments.length === 0) return null;

  return (
    `UPDATE ${quoteIdent(table)} SET ${assignments.join(', ')} ` +
    `WHERE ${quoteIdent(primaryKey)} = ${sqlLiteral(row[primaryKey])};`
  );
};

export const singletonUpdate = (
  table: string,
  primaryKey: string,
  columns: string[],
  row: TRow,
) => {
  const assignments = assignmentsOf(primaryKey, columns, row);
  if (assignments.length === 0) return null;

  return `UPDATE ${quoteIdent(table)} SET ${assignments.join(', ')};`;
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

export const deleteStatement = (
  table: string,
  primaryKey: string,
  keys: string[],
) =>
  `DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent(primaryKey)} IN (${keys
    .map(sqlLiteral)
    .join(', ')});`;

const FOLDER_COLUMNS = ['id', 'name', 'parent'];

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
  isSingleton: boolean;
  newRows: TRow[];
  changedRows: TRow[];
  extraKeys: string[];
  skipped: string[];
};

export const buildSqlScript = (
  source: TConnection,
  target: TConnection,
  rows: TDataChange[],
  selection: ReadonlySet<string>,
  mirrorData: boolean,
  excluded: TRecordExclusions = {},
  onLog?: (line: string) => void,
): Promise<TResult<string>> =>
  withResult(async () => {
    const from = clientFor(source);
    const to = clientFor(target);

    onLog?.('Taking a schema snapshot');
    const snapshot = await from.request(schemaSnapshot());

    const wanted = rows.filter(
      (row) => selection.has(row.collection) && !isEmptyChange(row),
    );

    const sides = await mapLimit(wanted, COMPARE_CONCURRENCY, (row, index) => {
      onLog?.(`Reading ${row.collection} (${index + 1}/${wanted.length})`);

      return readSides(from, to, snapshot, row);
    });

    onLog?.('Following the foreign keys of the picked records');

    const travelling = pullReferenced({
      excluded,
      relations: foreignKeysOf(snapshot),
      rows: new Map(sides.map((side) => [side.collection, side.sourceRows])),
      primaryKeys: new Map(
        sides.map((side) => [side.collection, side.primaryKey]),
      ),
      inTarget: new Map(
        sides.map((side) => [
          side.collection,
          new Set(side.targetByKey.keys()),
        ]),
      ),
    }).excluded;

    const diffs = sides.map((side) => diffSides(side, travelling, mirrorData));

    onLog?.('Collecting the files those records point at');
    const [fileRows, fileColumns] = await Promise.all([
      referencedFiles(from, to, diffs),
      readColumns(to, SYSTEM_COLLECTIONS.files),
    ]);
    const folderRows =
      fileRows.length > 0 ? await missingFolders(from, to) : [];
    const skippedFileColumns = unknownColumns(FILE_COLUMNS, fileColumns);

    const folderStatements = folderRows.map((row) =>
      insertRow(SYSTEM_COLLECTIONS.folders, 'id', FOLDER_COLUMNS, row),
    );

    const fileStatements = fileRows.map((row) =>
      insertRow(
        SYSTEM_COLLECTIONS.files,
        'id',
        FILE_COLUMNS.filter((name) => !skippedFileColumns.includes(name)),
        row,
      ),
    );

    onLog?.('Writing the statements');

    const stage1 = diffs.flatMap((diff) =>
      diff.isSingleton || diff.newRows.length === 0
        ? []
        : chunkArray(
            diff.newRows.map((row) => row[diff.primaryKey]),
            WRITE_BATCH_SIZE,
          ).map((batch) => insertStub(diff.collection, diff.primaryKey, batch)),
    );

    const stage2 = diffs
      .flatMap((diff) =>
        diff.isSingleton
          ? [
              ...diff.newRows.map((row) =>
                insertRow(diff.collection, diff.primaryKey, diff.columns, row),
              ),
              ...diff.changedRows.map((row) =>
                singletonUpdate(
                  diff.collection,
                  diff.primaryKey,
                  diff.columns,
                  row,
                ),
              ),
            ]
          : [...diff.newRows, ...diff.changedRows].map((row) =>
              updateStatement(
                diff.collection,
                diff.primaryKey,
                diff.columns,
                row,
              ),
            ),
      )
      .filter((line): line is string => line !== null);

    const stage3 = diffs.flatMap((diff) =>
      diff.extraKeys.length === 0
        ? []
        : [deleteStatement(diff.collection, diff.primaryKey, diff.extraKeys)],
    );

    const warnings = [
      ...(snapshot.vendor && snapshot.vendor !== 'postgres'
        ? [
            `-- WARNING: this script is written for PostgreSQL, and the ` +
              `source reports ${snapshot.vendor}.`,
          ]
        : []),

      ...diffs
        .filter((diff) => diff.skipped.length > 0)
        .map(
          (diff) =>
            `-- WARNING: ${diff.collection} — the target has no column for ` +
            `${diff.skipped.join(', ')}. That content is not in this script.`,
        ),

      ...(skippedFileColumns.length > 0
        ? [
            `-- WARNING: ${SYSTEM_COLLECTIONS.files} — the target has no ` +
              `column for ${skippedFileColumns.join(', ')}. Those values are omitted.`,
          ]
        : []),
    ];

    const sections = [
      warnings.length > 0 ? warnings.join('\n') : null,
      section('Folder metadata (directus_folders)', folderStatements),
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

type TCollectionSides = {
  collection: string;
  primaryKey: string;
  columns: string[];
  isSingleton: boolean;
  skipped: string[];

  csvColumns: string[];
  sourceRows: TRow[];
  targetByKey: Map<string, TRow>;
};

// Directus reads a csv field back as an array but stores it as one
// comma-separated string; written as JSON the CMS could no longer parse it.
const csvColumnsOf = (snapshot: SchemaSnapshotOutput, collection: string) =>
  snapshot.fields
    .filter((field) => field.collection === collection)
    .filter(
      (field) =>
        field.type === 'csv' ||
        (field.meta?.special ?? []).includes('cast-csv'),
    )
    .map((field) => String(field.field));

const asStored = (row: TRow, csvColumns: string[]): TRow => {
  if (csvColumns.length === 0) return row;

  const stored = { ...row };

  for (const column of csvColumns) {
    const value = stored[column];
    if (Array.isArray(value)) stored[column] = value.join(',');
  }

  return stored;
};

const readSides = async (
  from: TDirectusClient,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  row: TDataChange,
): Promise<TCollectionSides> => {
  const { collection, primaryKey } = row;
  const wanted = realColumnsOf(snapshot, collection);
  const skipped = unknownColumns(wanted, await readColumns(to, collection));
  const columns = wanted.filter((name) => !skipped.includes(name));

  const [sourceRows, targetRows] = await Promise.all([
    readAll(from, collection, primaryKey, columns),
    orMissing(readAll(to, collection, primaryKey, columns)),
  ]);

  return {
    collection,
    primaryKey,
    columns,
    isSingleton: isSingletonCollection(snapshot, collection),
    skipped,
    csvColumns: csvColumnsOf(snapshot, collection),
    sourceRows,
    targetByKey: new Map(
      (targetRows ?? []).map((item) => [String(item[primaryKey]), item]),
    ),
  };
};

const withoutKey = (row: TRow, primaryKey: string) => {
  const rest = { ...row };
  delete rest[primaryKey];
  return fingerprint(rest);
};

const diffSingleton = (sides: TCollectionSides): TCollectionDiff => {
  const { collection, primaryKey, columns, skipped } = sides;

  const empty = {
    collection,
    primaryKey,
    columns,
    isSingleton: true,
    newRows: [],
    changedRows: [],
    extraKeys: [],
    skipped,
  };

  const sourceRow = sides.sourceRows[0];
  if (!sourceRow) return empty;

  const targetRow = [...sides.targetByKey.values()][0];
  const stored = asStored(sourceRow, sides.csvColumns);

  if (!targetRow) return { ...empty, newRows: [stored] };

  return withoutKey(sourceRow, primaryKey) === withoutKey(targetRow, primaryKey)
    ? empty
    : { ...empty, changedRows: [stored] };
};

const diffSides = (
  sides: TCollectionSides,
  excluded: TRecordExclusions,
  mirrorData: boolean,
): TCollectionDiff => {
  if (sides.isSingleton) return diffSingleton(sides);

  const { collection, primaryKey, columns, skipped, csvColumns } = sides;

  const { newRows, changedRows, extraKeys } = diffRows({
    primaryKey,
    columns,
    sourceRows: sides.sourceRows,
    targetRows: [...sides.targetByKey.values()],
    excluded: excludedKeys(excluded, collection),
    mirror: mirrorData,
  });

  return {
    collection,
    primaryKey,
    columns,
    isSingleton: false,
    newRows: newRows.map((row) => asStored(row, csvColumns)),
    changedRows: changedRows.map((row) => asStored(row, csvColumns)),
    extraKeys,
    skipped,
  };
};

const missingFolders = async (
  from: TDirectusClient,
  to: TDirectusClient,
): Promise<TRow[]> => {
  const folders = await readAllFolders(from);
  if (folders.length === 0) return [];

  const existing = (await orMissing(readAllFolders(to))) ?? [];
  const known = new Set(existing.map((folder) => String(folder.id)));

  return inParentOrder(
    folders.filter((folder) => !known.has(String(folder.id))),
  );
};

const readAllFolders = (client: TDirectusClient) =>
  readPages<TRow>(
    KEY_PAGE_SIZE,
    (offset) =>
      client.request(
        readFolders({
          fields: FOLDER_COLUMNS,
          sort: ['id'],
          limit: KEY_PAGE_SIZE,
          offset,
        }),
      ) as Promise<TRow[]>,
  );

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

  // In slices: every id rides in the query string.
  const pages = await Promise.all(
    chunkArray(missing, ID_FILTER_SIZE).map((ids) =>
      from.request<TRow[]>(
        readFiles({
          filter: { id: { _in: ids } },
          limit: ids.length,
          fields: FILE_COLUMNS,
        }),
      ),
    ),
  );

  return pages.flatMap((page) => asRows(page));
};

const readFileKeys = async (client: TDirectusClient) => {
  const rows = await readPages<TRow>(
    KEY_PAGE_SIZE,
    (offset) =>
      client.request(
        readFiles({ fields: ['id'], limit: KEY_PAGE_SIZE, offset }),
      ) as Promise<TRow[]>,
  );

  return new Set(rows.map((row) => String(row.id)));
};
