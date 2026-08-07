import type { SchemaSnapshotOutput } from '@directus/sdk';
import {
  createFolder,
  createItems,
  customEndpoint,
  deleteItems,
  readFiles,
  readFolders,
  readMe,
  schemaApply,
  schemaDiff,
  schemaSnapshot,
  updateItemsBatch,
  updateSingleton,
} from '@directus/sdk';

import { API_FILES_URL, SYSTEM_COLLECTIONS } from '@/api';
import {
  AUDIT_FIELDS,
  AUDIT_USER_FIELDS,
  READ_PAGE_SIZE,
  WRITE_BATCH_SIZE,
} from '@/constants/run';
import type { TRow } from '@/models/common';
import { hostOf } from '@/models/connection';
import {
  RUN_STATUS_LEVEL,
  type TLogLevel,
  type TRun,
  type TRunRequest,
  type TRunUnit,
  type TStage,
} from '@/models/run';
import {
  clearPendingRelax,
  putPendingRelax,
} from '@/providers/constraintStore';
import { clientFor, type TDirectusClient } from '@/providers/directusClient';
import {
  getBackup,
  getSecrets,
  putBackup,
  putRun,
  putSecrets,
} from '@/providers/runStore';
import { chunkArray } from '@/utils/chunk';
import { withRetry } from '@/utils/retry';

import { applyRelax, planRelax, restoreConstraints } from './constraints';
import { isSingletonCollection, primaryKeyOf, realColumnsOf } from './data';
import { readAll, readKeys, readPages } from './paging';
import { onlyCollections, stripMetaChanges } from './schema';

type TCollectionPlan = {
  collection: string;
  primaryKey: string;
  isSingleton: boolean;

  columns: string[];

  hasAutoIncrement: boolean;
};

export const startRun = (request: TRunRequest): TRun => {
  const run: TRun = {
    id: crypto.randomUUID(),
    sourceHost: hostOf(request.source.url),
    targetHost: hostOf(request.target.url),
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    units: [
      createUnit('backup', 'backup'),
      ...(request.applySchema ? [createUnit('schema', 'schema')] : []),
      createUnit('files', 'files'),
      ...request.collections.map((collection) =>
        createUnit(collection, 'data'),
      ),
    ],
    log: [],
    stopRequested: false,
    sequenceResets: [],
    hasBackup: false,
    createdKeys: {},
  };

  putRun(run);
  putSecrets(run.id, { source: request.source, target: request.target });

  void execute(run, request);

  return run;
};

export const requestStop = (run: TRun) => {
  run.stopRequested = true;
  log(run, 'warn', 'Stop requested — finishing the current collection.');
  return run;
};

const createUnit = (name: string, stage: TStage): TRunUnit => ({
  name,
  stage,
  status: 'pending',
  written: 0,
  deleted: 0,
  error: null,
});

const log = (run: TRun, level: TLogLevel, message: string) => {
  run.log.push({ at: new Date().toISOString(), level, message });
};

const describe = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'errors' in error) {
    const [first] =
      (
        error as {
          errors?: { message?: string; extensions?: Record<string, unknown> }[];
        }
      ).errors ?? [];

    if (first?.message) {
      const { code, ...rest } = first.extensions ?? {};
      const detail = Object.entries(rest)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');

      return [first.message, code, detail].filter(Boolean).join(' | ');
    }
  }

  return error instanceof Error ? error.message : String(error);
};

const unitOf = (run: TRun, name: string) =>
  run.units.find((unit) => unit.name === name);

const execute = async (run: TRun, request: TRunRequest) => {
  try {
    const from = clientFor(request.source);
    const to = clientFor(request.target);

    const snapshot = await from.request(schemaSnapshot());

    await runStageUnit(run, 'backup', () =>
      captureBackup(run, to, request.collections),
    );

    if (!run.hasBackup) {
      log(run, 'error', 'Backup failed — nothing was written to the target.');
      return;
    }

    if (request.applySchema) {
      await runStageUnit(run, 'schema', () =>
        applySchemaDiff(
          run,
          to,
          snapshot,
          request.force,
          new Set(request.schemaCollections),
        ),
      );
    }

    if (request.collections.length > 0) {
      await runStageUnit(run, 'files', () => copyFiles(run, from, to));
      await copyData(run, from, to, snapshot, request.mirrorData);
    }
  } catch (error) {
    log(run, 'error', describe(error));
  } finally {
    finish(run);
  }
};

const runStageUnit = async (
  run: TRun,
  name: string,
  work: () => Promise<number>,
) => {
  const unit = unitOf(run, name);
  if (!unit) return;

  unit.status = 'running';
  log(run, 'info', `${name}: started`);

  try {
    unit.written = await work();
    unit.status = 'done';
    log(run, 'success', `${name}: done (${unit.written})`);
  } catch (error) {
    unit.status = 'failed';
    unit.error = describe(error);
    log(run, 'error', `${name}: ${unit.error}`);
  }
};

const captureBackup = async (
  run: TRun,
  to: TDirectusClient,
  collections: string[],
) => {
  const snapshot = await to.request(schemaSnapshot());
  const rows: Record<string, TRow[]> = {};

  let total = 0;

  for (const collection of collections) {
    try {
      rows[collection] = await readAll(
        to,
        collection,
        primaryKeyOf(snapshot, collection),
        realColumnsOf(snapshot, collection),
      );
      total += rows[collection].length;
    } catch {
      rows[collection] = [];
    }
  }

  putBackup(run.id, {
    capturedAt: new Date().toISOString(),
    snapshot,
    rows,
  });
  run.hasBackup = true;

  return total;
};

const applySchemaDiff = async (
  run: TRun,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  force: boolean,
  keep: ReadonlySet<string>,
) => {
  const diff = await to.request(schemaDiff(snapshot, force));

  if (!diff?.hash) {
    log(run, 'info', 'Schema already matches — nothing to apply.');
    return 0;
  }

  const structural = onlyCollections(
    stripMetaChanges(diff.diff as never),
    keep,
  ) as typeof diff.diff;
  const changeCount = [
    structural.collections,
    structural.fields,
    structural.relations,
  ].reduce((total, entries) => total + (entries?.length ?? 0), 0);

  if (changeCount === 0) {
    log(run, 'info', 'Only interface metadata differs — nothing to apply.');
    return 0;
  }

  await to.request(schemaApply({ ...diff, diff: structural }));
  return 1;
};

const copyFiles = async (
  run: TRun,
  from: TDirectusClient,
  to: TDirectusClient,
) => {
  const [folders, files] = await Promise.all([
    readAllFolders(from),
    readAllFiles(from),
  ]);

  const written =
    (await insertFolders(run, to, folders)) +
    (await insertFiles(run, to, files));

  log(run, 'info', `files: ${folders.length} folders, ${files.length} files`);
  return written;
};

const readAllFolders = (client: TDirectusClient) =>
  readPages<TRow>(
    READ_PAGE_SIZE,
    (offset) =>
      client.request(
        readFolders({ sort: ['id'], limit: READ_PAGE_SIZE, offset }),
      ) as Promise<TRow[]>,
  );

const readAllFiles = (client: TDirectusClient) =>
  readPages<TRow>(
    READ_PAGE_SIZE,
    (offset) =>
      client.request(
        readFiles({ sort: ['id'], limit: READ_PAGE_SIZE, offset }),
      ) as Promise<TRow[]>,
  );

export const inParentOrder = (folders: TRow[]) => {
  const ids = new Set(folders.map((folder) => String(folder.id)));
  const children = new Map<string, TRow[]>();
  const roots: TRow[] = [];

  for (const folder of folders) {
    const parent = folder.parent ? String(folder.parent) : null;

    if (parent === null || !ids.has(parent)) {
      roots.push(folder);
      continue;
    }

    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }

  const ordered: TRow[] = [];
  const written = new Set<string>();

  for (const root of roots) {
    const stack = [root];

    while (stack.length > 0) {
      const folder = stack.pop();
      if (!folder) break;

      const id = String(folder.id);
      if (written.has(id)) continue;

      written.add(id);
      ordered.push(folder);
      stack.push(...(children.get(id) ?? []));
    }
  }

  return [
    ...ordered,
    ...folders.filter((folder) => !written.has(String(folder.id))),
  ];
};

const insertFolders = async (
  run: TRun,
  to: TDirectusClient,
  folders: TRow[],
) => {
  if (folders.length === 0) return 0;

  const existing = new Set(
    (await readAllFolders(to)).map((folder) => String(folder.id)),
  );
  const missing = inParentOrder(
    folders.filter((folder) => !existing.has(String(folder.id))),
  );
  if (missing.length === 0) return 0;

  for (const folder of missing) {
    await to.request(createFolder(folder));
  }

  recordCreated(run, SYSTEM_COLLECTIONS.folders, missing);
  return missing.length;
};

const OWNER_FIELDS = ['uploaded_by', 'modified_by'] as const;

const insertFiles = async (run: TRun, to: TDirectusClient, files: TRow[]) => {
  if (files.length === 0) return 0;

  const existing = new Set(
    (await readAllFiles(to)).map((file) => String(file.id)),
  );
  const missing = files
    .filter((file) => !existing.has(String(file.id)))
    .map((file) => {
      const row = { ...file };
      for (const field of OWNER_FIELDS) delete row[field];
      return row;
    });
  if (missing.length === 0) return 0;

  for (const file of missing) {
    await to.request(
      customEndpoint({
        path: API_FILES_URL,
        method: 'POST',
        body: JSON.stringify(file),
      }),
    );
  }

  recordCreated(run, SYSTEM_COLLECTIONS.files, missing);
  return missing.length;
};

const recordCreated = (run: TRun, collection: string, rows: TRow[]) => {
  run.createdKeys[collection] = [
    ...(run.createdKeys[collection] ?? []),
    ...rows.map((row) => String(row.id)),
  ];
};

const copyData = async (
  run: TRun,
  from: TDirectusClient,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  mirrorData: boolean,
) => {
  const selected = run.units
    .filter((unit) => unit.stage === 'data')
    .map((unit) => unit.name);

  if (selected.length === 0) return;

  const plans = selected.map<TCollectionPlan>((collection) => {
    const primary = snapshot.fields.find(
      (field) =>
        field.collection === collection && field.schema?.is_primary_key,
    );

    return {
      collection,
      primaryKey: primaryKeyOf(snapshot, collection),
      columns: realColumnsOf(snapshot, collection),
      isSingleton: isSingletonCollection(snapshot, collection),
      hasAutoIncrement: primary?.schema?.has_auto_increment === true,
    };
  });

  const rowsByCollection = new Map<string, TRow[]>();

  run.sequenceResets = plans
    .filter((plan) => plan.hasAutoIncrement)
    .map((plan) => ({
      collection: plan.collection,
      primaryKey: plan.primaryKey,
    }));

  const migratingUser = plans.some((plan) => plan.isSingleton)
    ? await currentUserId(to)
    : null;

  log(run, 'info', 'Relaxing target constraints for the data stage.');

  const relaxed = await planRelax(to, selected);
  putPendingRelax({
    runId: run.id,
    targetHost: run.targetHost,
    relaxedAt: new Date().toISOString(),
    fields: relaxed,
  });
  await applyRelax(to, relaxed);

  try {
    for (const plan of plans) {
      if (run.stopRequested) break;

      const unit = unitOf(run, plan.collection);
      if (unit) unit.status = 'running';

      try {
        const rows = await withRetry(() =>
          readAll(from, plan.collection, plan.primaryKey, plan.columns),
        );
        rowsByCollection.set(plan.collection, rows);

        if (plan.isSingleton) {
          await to.request(
            updateSingleton(
              plan.collection,
              singletonSeed(
                migratingUser,
                plan.primaryKey,
                rows[0]?.[plan.primaryKey],
              ),
            ),
          );
        } else {
          const created = await insertMissing(
            run,
            to,
            plan.collection,
            plan.primaryKey,
            rows.map((row) => ({ [plan.primaryKey]: row[plan.primaryKey] })),
          );
          log(run, 'info', `${plan.collection}: ${created} new keys created`);
        }
      } catch (error) {
        failUnit(run, plan.collection, error);
      }
    }

    for (const plan of plans) {
      if (run.stopRequested) {
        log(run, 'warn', `Stopped before ${plan.collection}.`);
        break;
      }

      const unit = unitOf(run, plan.collection);
      if (!unit || unit.status === 'failed') continue;

      try {
        unit.written = await fillCollection(
          to,
          plan,
          rowsByCollection.get(plan.collection) ?? [],
          unit,
        );
        unit.status = 'done';

        log(run, 'success', `${plan.collection}: done (${unit.written})`);
      } catch (error) {
        failUnit(run, plan.collection, error);
      }
    }

    if (mirrorData) {
      await mirrorDeletes(run, to, plans, rowsByCollection);
    }
  } finally {
    await restoreConstraints(to, relaxed);
    clearPendingRelax(run.id);
    log(run, 'info', `Restored ${relaxed.length} target constraints.`);
  }
};

const mirrorDeletes = async (
  run: TRun,
  to: TDirectusClient,
  plans: TCollectionPlan[],
  rowsByCollection: Map<string, TRow[]>,
) => {
  for (const plan of plans) {
    if (run.stopRequested) {
      log(
        run,
        'warn',
        `Stopped before mirroring deletes in ${plan.collection}.`,
      );
      break;
    }

    const unit = unitOf(run, plan.collection);
    if (!unit || unit.status === 'failed' || plan.isSingleton) continue;

    try {
      const sourceKeys = new Set(
        (rowsByCollection.get(plan.collection) ?? []).map((row) =>
          String(row[plan.primaryKey]),
        ),
      );

      const targetKeys = await withRetry(() =>
        readKeys(to, plan.collection, plan.primaryKey),
      );

      const extra = [...targetKeys].filter((key) => !sourceKeys.has(key));
      if (extra.length === 0) continue;

      for (const batch of chunkArray(extra, WRITE_BATCH_SIZE)) {
        await withRetry(() => to.request(deleteItems(plan.collection, batch)));
        unit.deleted += batch.length;
      }

      log(
        run,
        'warn',
        `${plan.collection}: deleted ${unit.deleted} rows only in the target`,
      );
    } catch (error) {
      failUnit(run, plan.collection, error);
    }
  }
};

const fillCollection = async (
  to: TDirectusClient,
  plan: TCollectionPlan,
  rows: TRow[],
  unit: TRunUnit,
) => {
  if (rows.length === 0) return 0;

  if (plan.isSingleton) {
    await to.request(updateSingleton(plan.collection, blankAudit(rows[0])));
    return 1;
  }

  let written = 0;

  for (const batch of chunkArray(rows.map(blankAudit), WRITE_BATCH_SIZE)) {
    await withRetry(() => to.request(updateItemsBatch(plan.collection, batch)));
    written += batch.length;

    unit.written = written;
  }

  return written;
};

const insertMissing = async (
  run: TRun,
  to: TDirectusClient,
  collection: string,
  primaryKey: string,
  rows: TRow[],
) => {
  if (rows.length === 0) return 0;

  const existing = await withRetry(() => readKeys(to, collection, primaryKey));
  const missing = rows.filter((row) => !existing.has(String(row[primaryKey])));

  for (const batch of chunkArray(missing, WRITE_BATCH_SIZE)) {
    await withRetry(() => to.request(createItems(collection, batch)));
  }

  run.createdKeys[collection] = [
    ...(run.createdKeys[collection] ?? []),
    ...missing.map((row) => String(row[primaryKey])),
  ];

  return missing.length;
};

export const withoutAuditUsers = (row: TRow): TRow =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([field]) =>
        !AUDIT_USER_FIELDS.includes(
          field as (typeof AUDIT_USER_FIELDS)[number],
        ),
    ),
  );

export const blankAudit = (row: TRow): TRow => ({
  ...row,
  ...Object.fromEntries(AUDIT_FIELDS.map((field) => [field, null])),
});

const currentUserId = async (client: TDirectusClient) => {
  try {
    const me = await client.request(readMe({ fields: ['id'] }));
    return me?.id ? String(me.id) : null;
  } catch {
    return null;
  }
};

const singletonSeed = (
  userId: string | null,
  primaryKey: string,
  sourceKey: unknown,
): TRow => ({
  ...(userId ? { user_created: userId, user_updated: userId } : {}),

  ...(sourceKey === null || sourceKey === undefined
    ? {}
    : { [primaryKey]: sourceKey }),
});

const failUnit = (run: TRun, collection: string, error: unknown) => {
  const unit = unitOf(run, collection);
  if (!unit) return;

  unit.status = 'failed';
  unit.error = describe(error);
  log(run, 'error', `${collection}: ${unit.error}`);
};

const finish = (run: TRun) => {
  const failed = run.units.filter((unit) => unit.status === 'failed').length;
  const done = run.units.filter((unit) => unit.status === 'done').length;

  run.finishedAt = new Date().toISOString();
  run.status = run.stopRequested
    ? 'stopped'
    : failed === 0
      ? 'succeeded'
      : done === 0
        ? 'failed'
        : 'partial';

  if (run.sequenceResets.length > 0) {
    log(
      run,
      'warn',
      `${run.sequenceResets.length} sequence(s) need resetting — see the result screen.`,
    );
  }

  log(run, RUN_STATUS_LEVEL[run.status], `Run ${run.status}.`);
};

export const rollbackRun = async (run: TRun) => {
  const backup = getBackup(run.id);
  const secrets = getSecrets(run.id);

  if (!backup || !secrets) throw new Error('No backup for this run');

  const to = clientFor(secrets.target);
  const snapshot = await to.request(schemaSnapshot());

  log(run, 'info', 'Rollback started.');

  const collections = Object.keys(backup.rows);

  const relaxed = await planRelax(to, collections);
  putPendingRelax({
    runId: run.id,
    targetHost: run.targetHost,
    relaxedAt: new Date().toISOString(),
    fields: relaxed,
  });
  await applyRelax(to, relaxed);

  try {
    for (const [collection, keys] of Object.entries(run.createdKeys)) {
      if (keys.length === 0) continue;

      for (const batch of chunkArray(keys, WRITE_BATCH_SIZE)) {
        await to.request(deleteItems(collection, batch));
      }
      log(run, 'info', `${collection}: removed ${keys.length} created rows`);
    }

    for (const [collection, rows] of Object.entries(backup.rows)) {
      if (rows.length === 0) continue;

      if (isSingletonCollection(snapshot, collection)) {
        await to.request(
          updateSingleton(collection, withoutAuditUsers(rows[0])),
        );
        continue;
      }

      const primaryKey = primaryKeyOf(snapshot, collection);
      const revived = await insertMissing(
        run,
        to,
        collection,
        primaryKey,
        rows.map((row) => ({ [primaryKey]: row[primaryKey] })),
      );

      if (revived > 0) {
        log(run, 'info', `${collection}: recreated ${revived} deleted rows`);
      }

      for (const batch of chunkArray(
        rows.map(withoutAuditUsers),
        WRITE_BATCH_SIZE,
      )) {
        await to.request(updateItemsBatch(collection, batch));
      }
      log(run, 'info', `${collection}: restored ${rows.length} rows`);
    }

    run.status = 'rolled-back';
    run.createdKeys = {};
    log(run, 'success', 'Rollback finished.');
  } catch (error) {
    log(run, 'error', `Rollback failed: ${describe(error)}`);
    throw error;
  } finally {
    await restoreConstraints(to, relaxed);
    clearPendingRelax(run.id);
  }

  return run;
};
