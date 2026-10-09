import type { SchemaSnapshotOutput } from '@directus/sdk';
import {
  createFolder,
  createItems,
  customEndpoint,
  deleteItems,
  readFiles,
  readFolders,
  readItems,
  readMe,
  schemaSnapshot,
  updateItemsBatch,
  updateSingleton,
} from '@directus/sdk';

import {
  API_FILES_URL,
  isSystemName,
  SYSTEM_COLLECTIONS,
} from '@/constants/directus';
import {
  AUDIT_FIELDS,
  AUDIT_USER_FIELDS,
  READ_PAGE_SIZE,
  WRITE_BATCH_SIZE,
} from '@/constants/run';
import { clientFor, type TDirectusClient } from '@/lib/directus/client';
import {
  pendingRelaxFor,
  putPendingRelax,
  settlePendingRelax,
} from '@/lib/store/constraints';
import {
  getBackup,
  getSecrets,
  listRuns,
  putBackup,
  putRun,
  putSecrets,
} from '@/lib/store/runs';
import type { TRow } from '@/models/common';
import { hostOf, type TConnection } from '@/models/connection';
import {
  excludedKeys,
  type TRecordExclusions,
  unknownMetaKeys,
} from '@/models/plan';
import {
  isFinished,
  RUN_STATUS_LEVEL,
  type TLogLevel,
  type TRun,
  type TRunRequest,
  type TRunUnit,
  type TStage,
} from '@/models/run';
import { chunkArray } from '@/utils/chunk';
import { describeErrorInDetail } from '@/utils/describeError';
import { withRetry } from '@/utils/retry';
import { asRows } from '@/utils/rows';

import {
  applyRelax,
  fieldNames,
  mergeRelaxed,
  planRelax,
  restoreConstraints,
  type TRelaxedField,
} from './constraints';
import {
  diffRows,
  fingerprint,
  isSingletonCollection,
  primaryKeyOf,
  readSingletonRow,
  realColumnsOf,
  type TRowDiff,
} from './data';
import { orMissing } from './errors';
import { inParentOrder } from './folders';
import { readAll, readPages } from './paging';
import {
  foreignKeysOf,
  pulledSummary,
  pullReferenced,
  type TPickRelation,
} from './picks';
import {
  compatibilityOf,
  onlyCollections,
  pruneUnknownMeta,
  readColumns,
  readMetaColumns,
  stripMetaChanges,
  unknownColumns,
  withoutUnknownKeys,
} from './schema';
import { applySchema, diffSchema } from './schemaTransfer';

type TConnect = (connection: TConnection) => TDirectusClient;

type TCollectionPlan = {
  collection: string;
  primaryKey: string;
  isSingleton: boolean;

  columns: string[];

  hasAutoIncrement: boolean;
};

type TCollectionWork = TRowDiff & {
  plan: TCollectionPlan;

  // New rows that exist on the target as a bare key, and how many of those
  // have since been given their content.
  stubbed: number;
  filled: number;
};

export const startRun = (
  request: TRunRequest,
  connect: TConnect = clientFor,
): TRun => {
  const targetHost = hostOf(request.target.url);

  // Two runs on one target would each relax and restore the same constraints
  // around the other's writes.
  if (
    listRuns().some(
      (held) => held.targetHost === targetHost && !isFinished(held),
    )
  ) {
    throw new Error(`A run against ${targetHost} is still in progress`);
  }

  const run: TRun = {
    id: crypto.randomUUID(),
    sourceHost: hostOf(request.source.url),
    targetHost,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    units: [
      createUnit('backup', 'backup'),
      ...(request.applySchema ? [createUnit('schema', 'schema')] : []),
      ...(request.collections.length > 0 ? [createUnit('files', 'files')] : []),
      ...request.collections.map((collection) =>
        createUnit(collection, 'data'),
      ),
    ],
    log: [],
    stopRequested: false,
    error: null,
    sequenceResets: [],
    hasBackup: false,
    createdKeys: {},
  };

  putRun(run);
  putSecrets(run.id, { source: request.source, target: request.target });

  void execute(run, request, connect);

  return run;
};

export const requestStop = (run: TRun) => {
  run.stopRequested = true;
  log(run, 'warn', 'Stop requested — finishing the current collection.');
  releaseBackupHold(run);
  return run;
};

const backupHolds = new Map<string, () => void>();

/**
 * The backup lives in this tab's memory and nowhere else, so a reload after
 * the first write would leave nothing to roll back to. Nothing is written
 * until the user has been handed the file.
 */
const holdForBackupDownload = (run: TRun) => {
  run.status = 'awaiting-backup';
  log(run, 'warn', 'Backup captured — waiting for it to be downloaded.');

  return new Promise<void>((resolve) => backupHolds.set(run.id, resolve));
};

const releaseBackupHold = (run: TRun) => {
  const release = backupHolds.get(run.id);
  if (!release) return;

  backupHolds.delete(run.id);
  run.status = 'running';
  release();
};

export const resumeAfterBackup = (run: TRun) => {
  releaseBackupHold(run);
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

const describe = describeErrorInDetail;

const unitOf = (run: TRun, name: string) =>
  run.units.find((unit) => unit.name === name);

const hasFailed = (run: TRun, name: string) =>
  unitOf(run, name)?.status === 'failed';

/**
 * A failure outside any one unit — it would otherwise only reach the log and
 * leave the run reading as a success.
 */
const failRun = (run: TRun, message: string) => {
  run.error ??= message;
  log(run, 'error', message);
};

const execute = async (run: TRun, request: TRunRequest, connect: TConnect) => {
  try {
    const from = connect(request.source);
    const to = connect(request.target);

    const snapshot = await withRetry(() => from.request(schemaSnapshot()));

    await runStageUnit(run, 'backup', () =>
      captureBackup(run, to, request.collections),
    );

    if (!run.hasBackup) {
      log(run, 'error', 'Backup failed — nothing was written to the target.');
      return;
    }

    await holdForBackupDownload(run);

    if (run.stopRequested) {
      log(run, 'warn', 'Stopped — nothing was written to the target.');
      return;
    }

    log(run, 'info', 'Backup downloaded — writing to the target.');

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

    if (request.collections.length > 0 && !hasFailed(run, 'schema')) {
      await runStageUnit(run, 'files', () => copyFiles(run, from, to));

      if (hasFailed(run, 'files')) {
        log(run, 'error', 'Files failed — no collection data was written.');
        return;
      }

      await copyData(run, from, to, snapshot, request);
    }
  } catch (error) {
    failRun(run, describe(error));
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

/**
 * Only a collection the target does not have yet backs up as empty. Any other
 * failed read fails the backup: a run must not overwrite rows it could not
 * save first.
 */
const captureBackup = async (
  run: TRun,
  to: TDirectusClient,
  collections: string[],
) => {
  const snapshot = await withRetry(() => to.request(schemaSnapshot()));
  const rows: Record<string, TRow[]> = {};

  let total = 0;

  for (const collection of collections) {
    rows[collection] = await readTargetRows(to, snapshot, collection);
    total += rows[collection].length;
  }

  putBackup(run.id, {
    capturedAt: new Date().toISOString(),
    snapshot,
    rows,
  });
  run.hasBackup = true;

  return total;
};

const readTargetRows = async (
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  collection: string,
): Promise<TRow[]> => {
  const columns = realColumnsOf(snapshot, collection);

  if (isSingletonCollection(snapshot, collection)) {
    const row = await orMissing(
      withRetry(() => readSingletonRow(to, collection, columns)),
    );

    return row ? [row] : [];
  }

  return (
    (await orMissing(
      withRetry(() =>
        readAll(to, collection, primaryKeyOf(snapshot, collection), columns),
      ),
    )) ?? []
  );
};

const applySchemaDiff = async (
  run: TRun,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  force: boolean,
  keep: ReadonlySet<string>,
) => {
  const diff = await to.request(diffSchema(snapshot, force));

  if (!diff?.hash) {
    log(run, 'info', 'Schema already matches — nothing to apply.');
    return 0;
  }

  const [targetSnapshot, metaColumns] = await Promise.all([
    to.request(schemaSnapshot()),
    readMetaColumns(to),
  ]);

  const compatibility = compatibilityOf(snapshot, targetSnapshot, metaColumns);

  const unknown = unknownMetaKeys(compatibility);

  if (unknown.length > 0) {
    log(
      run,
      'warn',
      `schema: dropping ${unknown.length} meta key(s) the target ` +
        `(${compatibility.targetVersion}) does not have, sent by the source ` +
        `(${compatibility.sourceVersion}): ${unknown.join(', ')}`,
    );
  }

  const structural = onlyCollections(
    pruneUnknownMeta(
      stripMetaChanges(diff.diff as never),
      compatibility.unknownMeta,
    ),
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

  await to.request(applySchema({ ...diff, diff: structural }));
  return 1;
};

/**
 * Every file and folder row, not only the ones a relation points at: rich
 * text embeds files by id with no relation to follow.
 */
const copyFiles = async (
  run: TRun,
  from: TDirectusClient,
  to: TDirectusClient,
) => {
  const [folders, files] = await Promise.all([
    withRetry(() => readAllFolders(from)),
    withRetry(() => readAllFiles(from)),
  ]);

  const written =
    (await insertFolders(
      run,
      to,
      await keptKeys(run, to, SYSTEM_COLLECTIONS.folders, folders),
    )) +
    (await insertFiles(
      run,
      to,
      await keptKeys(run, to, SYSTEM_COLLECTIONS.files, files),
    ));

  log(run, 'info', `files: ${folders.length} folders, ${files.length} files`);
  return written;
};

const keptKeys = async (
  run: TRun,
  to: TDirectusClient,
  collection: string,
  rows: TRow[],
) => {
  const known = await readColumns(to, collection);

  const missing = unknownColumns(
    [...new Set(rows.flatMap((row) => Object.keys(row)))],
    known,
  );

  if (missing.length > 0) {
    log(
      run,
      'warn',
      `${collection}: dropping ${missing.length} key(s) the target has no ` +
        `column for: ${missing.join(', ')}`,
    );
  }

  return rows.map((row) => withoutUnknownKeys(row, known));
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

const insertFolders = async (
  run: TRun,
  to: TDirectusClient,
  folders: TRow[],
) => {
  if (folders.length === 0) return 0;

  const existing = new Set(
    (await withRetry(() => readAllFolders(to))).map((folder) =>
      String(folder.id),
    ),
  );
  const missing = inParentOrder(
    folders.filter((folder) => !existing.has(String(folder.id))),
  );

  for (const folder of missing) {
    await to.request(createFolder(folder));
    recordCreated(run, SYSTEM_COLLECTIONS.folders, [String(folder.id)]);
  }

  return missing.length;
};

const OWNER_FIELDS = ['uploaded_by', 'modified_by'] as const;

const insertFiles = async (run: TRun, to: TDirectusClient, files: TRow[]) => {
  if (files.length === 0) return 0;

  const existing = new Set(
    (await withRetry(() => readAllFiles(to))).map((file) => String(file.id)),
  );
  const missing = files
    .filter((file) => !existing.has(String(file.id)))
    .map((file) => {
      const row = { ...file };
      for (const field of OWNER_FIELDS) delete row[field];
      return row;
    });

  for (const file of missing) {
    await to.request(
      customEndpoint({
        path: API_FILES_URL,
        method: 'POST',
        body: JSON.stringify(file),
      }),
    );
    recordCreated(run, SYSTEM_COLLECTIONS.files, [String(file.id)]);
  }

  return missing.length;
};

// Recorded as each write lands, so a failure part-way through still leaves
// rollback knowing what this run put on the target.
const recordCreated = (run: TRun, collection: string, keys: string[]) => {
  run.createdKeys[collection] = [
    ...(run.createdKeys[collection] ?? []),
    ...keys,
  ];
};

const planCollections = (
  run: TRun,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  selected: string[],
) =>
  Promise.all(
    selected.map<Promise<TCollectionPlan>>(async (collection) => {
      const primary = snapshot.fields.find(
        (field) =>
          field.collection === collection && field.schema?.is_primary_key,
      );

      const wanted = realColumnsOf(snapshot, collection);
      const missing = unknownColumns(wanted, await readColumns(to, collection));

      if (missing.length > 0) {
        log(
          run,
          'warn',
          `${collection}: the target has no column for ${missing.join(', ')} — ` +
            `that content will not be migrated. Apply the schema first to carry it over.`,
        );
      }

      return {
        collection,
        primaryKey: primaryKeyOf(snapshot, collection),
        columns: wanted.filter((name) => !missing.includes(name)),
        isSingleton: isSingletonCollection(snapshot, collection),
        hasAutoIncrement: primary?.schema?.has_auto_increment === true,
      };
    }),
  );

const withoutKey = (row: TRow, primaryKey: string) => {
  const rest = { ...row };
  delete rest[primaryKey];
  return fingerprint(rest);
};

const readSourceRows = async (from: TDirectusClient, plan: TCollectionPlan) => {
  if (!plan.isSingleton) {
    return withRetry(() =>
      readAll(from, plan.collection, plan.primaryKey, plan.columns),
    );
  }

  const row = await withRetry(() =>
    readSingletonRow(from, plan.collection, plan.columns),
  );

  return row ? [row] : [];
};

const diffSingleton = (
  plan: TCollectionPlan,
  sourceRows: TRow[],
  targetRows: TRow[],
): TRowDiff => {
  const [source] = sourceRows;
  const [target] = targetRows;

  const changed =
    source !== undefined &&
    (target === undefined ||
      withoutKey(source, plan.primaryKey) !==
        withoutKey(
          Object.fromEntries(plan.columns.map((name) => [name, target[name]])),
          plan.primaryKey,
        ));

  return { newRows: [], changedRows: changed ? [source] : [], extraKeys: [] };
};

/**
 * Reads the source once and compares it against the backup just taken, which
 * is the target as this run found it. Only rows that are new or different get
 * written — rewriting the rest would stamp revisions and fire flows on
 * records nothing happened to.
 */
const planWork = async ({
  run,
  from,
  plans,
  relations,
  excluded,
  targetRows,
  mirror,
}: {
  run: TRun;
  from: TDirectusClient;
  plans: TCollectionPlan[];
  relations: TPickRelation[];
  excluded: TRecordExclusions;
  targetRows: Record<string, TRow[]>;
  mirror: boolean;
}): Promise<TCollectionWork[]> => {
  const sourceRows = new Map<string, TRow[]>();

  for (const plan of plans) {
    try {
      sourceRows.set(plan.collection, await readSourceRows(from, plan));
    } catch (error) {
      failUnit(run, plan.collection, error);
    }
  }

  const readable = plans.filter((plan) => sourceRows.has(plan.collection));
  const lists = readable.filter((plan) => !plan.isSingleton);

  const expanded = pullReferenced({
    excluded,
    relations,
    rows: new Map(
      lists.map((plan) => [
        plan.collection,
        sourceRows.get(plan.collection) ?? [],
      ]),
    ),
    primaryKeys: new Map(
      lists.map((plan) => [plan.collection, plan.primaryKey]),
    ),
    inTarget: new Map(
      lists.map((plan) => [
        plan.collection,
        new Set(
          (targetRows[plan.collection] ?? []).map((row) =>
            String(row[plan.primaryKey]),
          ),
        ),
      ]),
    ),
  });

  const summary = pulledSummary(expanded.pulled);

  if (summary) {
    log(
      run,
      'warn',
      `Pulled in records the picked ones point at: ${summary}. ` +
        `Without them the target would reject the foreign keys.`,
    );
  }

  return readable.map((plan) => {
    const source = sourceRows.get(plan.collection) ?? [];
    const target = targetRows[plan.collection] ?? [];

    const diff = plan.isSingleton
      ? diffSingleton(plan, source, target)
      : diffRows({
          primaryKey: plan.primaryKey,
          columns: plan.columns,
          sourceRows: source,
          targetRows: target,
          excluded: excludedKeys(expanded.excluded, plan.collection),
          mirror,
        });

    log(
      run,
      'info',
      `${plan.collection}: ${diff.newRows.length} new, ` +
        `${diff.changedRows.length} changed` +
        (mirror ? `, ${diff.extraKeys.length} only in the target` : ''),
    );

    return { ...diff, plan, stubbed: 0, filled: 0 };
  });
};

/**
 * Constraints still relaxed from an earlier run are folded in, so their real
 * definitions are restored by this run too and never overwritten by a plan
 * taken while they were relaxed.
 */
const relaxTarget = async (
  run: TRun,
  to: TDirectusClient,
  collections: string[],
) => {
  const relaxed = mergeRelaxed(
    pendingRelaxFor(run.targetHost),
    await planRelax(to, collections),
  );

  putPendingRelax({
    runId: run.id,
    targetHost: run.targetHost,
    relaxedAt: new Date().toISOString(),
    fields: relaxed,
  });

  return relaxed;
};

const restoreTarget = async (
  run: TRun,
  to: TDirectusClient,
  relaxed: TRelaxedField[],
) => {
  const failures = await restoreConstraints(to, relaxed);
  const stillRelaxed = failures.map((failure) => failure.field);

  settlePendingRelax(run.id, stillRelaxed);

  if (failures.length === 0) {
    log(run, 'info', `Restored ${relaxed.length} target constraints.`);
    return;
  }

  failRun(
    run,
    `${failures.length} target constraint(s) could not be restored and are ` +
      `still relaxed: ${fieldNames(stillRelaxed)} — ${describe(failures[0].error)}`,
  );
};

const copyData = async (
  run: TRun,
  from: TDirectusClient,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  request: TRunRequest,
) => {
  const selected = run.units
    .filter((unit) => unit.stage === 'data')
    .map((unit) => unit.name);

  const plans = await planCollections(run, to, snapshot, selected);

  run.sequenceResets = plans
    .filter((plan) => plan.hasAutoIncrement)
    .map((plan) => ({
      collection: plan.collection,
      primaryKey: plan.primaryKey,
    }));

  const work = await planWork({
    run,
    from,
    plans,
    relations: foreignKeysOf(snapshot),
    excluded: request.excluded,
    targetRows: getBackup(run.id)?.rows ?? {},
    mirror: request.mirrorData,
  });

  const migratingUser = work.some(
    (item) => item.plan.isSingleton && item.changedRows.length > 0,
  )
    ? await currentUserId(to)
    : null;

  log(run, 'info', 'Relaxing target constraints for the data stage.');

  const relaxed = await relaxTarget(run, to, selected);

  try {
    await applyRelax(to, relaxed);

    await createKeys(run, to, work, migratingUser);
    await fillRows(run, to, work);

    if (request.mirrorData) await mirrorDeletes(run, to, work);

    reportStubs(run, work);
  } finally {
    await restoreTarget(run, to, relaxed);
  }
};

// Pass 1: every new row exists as a bare key before any row is filled, so a
// row may reference any other no matter which collection lands first.
const createKeys = async (
  run: TRun,
  to: TDirectusClient,
  work: TCollectionWork[],
  migratingUser: string | null,
) => {
  for (const item of work) {
    if (run.stopRequested) break;

    const { plan } = item;
    const unit = unitOf(run, plan.collection);
    if (unit) unit.status = 'running';

    try {
      if (plan.isSingleton) {
        const [row] = item.changedRows;

        if (row) {
          await to.request(
            updateSingleton(
              plan.collection,
              singletonSeed(
                migratingUser,
                plan.primaryKey,
                row[plan.primaryKey],
              ),
            ),
          );
        }

        continue;
      }

      await createRows(
        to,
        plan.collection,
        plan.primaryKey,
        item.newRows.map((row) => ({
          [plan.primaryKey]: row[plan.primaryKey],
        })),
        (keys) => {
          item.stubbed += keys.length;
          recordCreated(run, plan.collection, keys);
        },
      );

      if (item.stubbed > 0) {
        log(
          run,
          'info',
          `${plan.collection}: ${item.stubbed} new keys created`,
        );
      }
    } catch (error) {
      failUnit(run, plan.collection, error);
    }
  }
};

// Pass 2: new rows first, so `filled` counts how many bare keys got content.
const fillRows = async (
  run: TRun,
  to: TDirectusClient,
  work: TCollectionWork[],
) => {
  for (const item of work) {
    const { plan } = item;

    if (run.stopRequested) {
      log(run, 'warn', `Stopped before ${plan.collection}.`);
      break;
    }

    const unit = unitOf(run, plan.collection);
    if (!unit || unit.status !== 'running') continue;

    try {
      if (plan.isSingleton) {
        const [row] = item.changedRows;

        if (row) {
          await to.request(updateSingleton(plan.collection, blankAudit(row)));
          unit.written = 1;
        }
      } else {
        const rows = [...item.newRows, ...item.changedRows].map(blankAudit);

        for (const batch of chunkArray(rows, WRITE_BATCH_SIZE)) {
          await updateRows(to, plan.collection, plan.primaryKey, batch);

          unit.written += batch.length;
          item.filled = Math.min(unit.written, item.newRows.length);
        }
      }

      unit.status = 'done';
      log(run, 'success', `${plan.collection}: done (${unit.written})`);
    } catch (error) {
      failUnit(run, plan.collection, error);
    }
  }
};

const mirrorDeletes = async (
  run: TRun,
  to: TDirectusClient,
  work: TCollectionWork[],
) => {
  for (const item of work) {
    const { plan } = item;

    if (run.stopRequested) {
      log(
        run,
        'warn',
        `Stopped before mirroring deletes in ${plan.collection}.`,
      );
      break;
    }

    const unit = unitOf(run, plan.collection);
    if (!unit || unit.status !== 'done' || item.extraKeys.length === 0)
      continue;

    try {
      for (const batch of chunkArray(item.extraKeys, WRITE_BATCH_SIZE)) {
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

/**
 * A stop or a failure between the two passes leaves new rows holding nothing
 * but their key. They are not deleted here — a cascading foreign key could
 * take rows this run did fill with them. The unit fails loudly instead; a
 * second run fills them and a rollback removes them.
 */
const reportStubs = (run: TRun, work: TCollectionWork[]) => {
  for (const item of work) {
    const empty = item.stubbed - item.filled;
    if (empty <= 0) continue;

    const unit = unitOf(run, item.plan.collection);
    const message =
      `${empty} new row(s) hold only their key, with no content — ` +
      `run again to fill them or roll back to remove them`;

    if (unit && unit.status !== 'failed') {
      unit.status = 'failed';
      unit.error = message;
    }

    log(run, 'error', `${item.plan.collection}: ${message}`);
  }
};

const keysAlreadyThere = async (
  to: TDirectusClient,
  collection: string,
  primaryKey: string,
  keys: unknown[],
) =>
  new Set(
    asRows(
      await to.request<TRow[]>(
        readItems(collection, {
          fields: [primaryKey],
          filter: { [primaryKey]: { _in: keys } },
          limit: keys.length,
        }),
      ),
    ).map((row) => String(row[primaryKey])),
  );

/**
 * A create whose response was lost may still have landed. A retry therefore
 * re-reads the batch and creates only what is still missing, rather than
 * failing on the duplicates of its own first attempt.
 */
const createRows = async (
  to: TDirectusClient,
  collection: string,
  primaryKey: string,
  rows: TRow[],
  onCreated: (keys: string[]) => void,
) => {
  for (const batch of chunkArray(rows, WRITE_BATCH_SIZE)) {
    let attempted = false;

    await withRetry(async () => {
      const there = attempted
        ? await keysAlreadyThere(
            to,
            collection,
            primaryKey,
            batch.map((row) => row[primaryKey]),
          )
        : new Set<string>();
      attempted = true;

      const pending = batch.filter(
        (row) => !there.has(String(row[primaryKey])),
      );

      if (pending.length > 0) {
        await to.request(createItems(collection, pending));
      }
    });

    onCreated(batch.map((row) => String(row[primaryKey])));
  }
};

// Directus words it "request entity too large", under a 400 or a 413
// depending on which layer refused the body.
const isTooLarge = (error: unknown) =>
  (error as { response?: { status?: number } } | null)?.response?.status ===
    413 || /too large/i.test(describe(error));

/**
 * A batch is sized by row count, but the target caps a request by bytes
 * (MAX_PAYLOAD_SIZE), and a few rows of rich text can pass it. A refused
 * batch is halved until it fits; only a single row that is too big on its
 * own is a real failure.
 */
const updateRows = async (
  to: TDirectusClient,
  collection: string,
  primaryKey: string,
  rows: TRow[],
): Promise<void> => {
  try {
    await withRetry(() => to.request(updateItemsBatch(collection, rows)));
  } catch (error) {
    if (!isTooLarge(error)) throw error;

    if (rows.length === 1) {
      throw new Error(
        `${collection} ${String(rows[0][primaryKey])} is larger than the ` +
          `target accepts in one request — raise MAX_PAYLOAD_SIZE on the target`,
      );
    }

    const half = Math.ceil(rows.length / 2);

    await updateRows(to, collection, primaryKey, rows.slice(0, half));
    await updateRows(to, collection, primaryKey, rows.slice(half));
  }
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
  // A unit caught mid-flight never finished: it failed if the run broke
  // under it, and simply did not happen if the run was stopped.
  for (const unit of run.units) {
    if (unit.status !== 'running') continue;

    unit.status = run.error ? 'failed' : 'pending';
    if (run.error) unit.error = run.error;
  }

  const failed = run.units.some((unit) => unit.status === 'failed');
  const untouched = run.units.some((unit) => unit.status === 'pending');
  const wrote = run.units.some(
    (unit) => unit.stage !== 'backup' && unit.status === 'done',
  );

  run.finishedAt = new Date().toISOString();

  if (failed || run.error) run.status = wrote ? 'partial' : 'failed';
  else if (run.stopRequested && untouched) run.status = 'stopped';
  else run.status = 'succeeded';

  if (run.sequenceResets.length > 0) {
    log(
      run,
      'warn',
      `${run.sequenceResets.length} sequence(s) need resetting — see the result screen.`,
    );
  }

  log(run, RUN_STATUS_LEVEL[run.status], `Run ${run.status}.`);
};

/**
 * Puts the backed-up collections back the way the backup found them, judged
 * by what the target holds now rather than by what the run remembers doing —
 * so a rollback that failed half-way can simply be run again.
 */
export const rollbackRun = async (run: TRun, connect: TConnect = clientFor) => {
  const backup = getBackup(run.id);
  const secrets = getSecrets(run.id);

  if (!backup || !secrets) {
    // Logged like every other rollback failure: the run log is the only
    // place the screen shows them.
    log(run, 'error', 'Rollback failed: No backup for this run');
    throw new Error('No backup for this run');
  }

  const to = connect(secrets.target);
  const settled = run.status;

  run.status = 'rolling-back';
  log(run, 'info', 'Rollback started.');

  try {
    const snapshot = await withRetry(() => to.request(schemaSnapshot()));
    const relaxed = await relaxTarget(run, to, Object.keys(backup.rows));

    try {
      await applyRelax(to, relaxed);

      const current = new Map<string, TRow[]>();

      for (const [collection, rows] of Object.entries(backup.rows)) {
        current.set(
          collection,
          await restoreRows(run, to, snapshot, collection, rows),
        );
      }

      for (const [collection, keys] of Object.entries(run.createdKeys)) {
        await removeCreated(
          run,
          to,
          snapshot,
          collection,
          keys,
          backup.rows[collection],
          current.get(collection),
        );
      }
    } finally {
      await restoreTarget(run, to, relaxed);
    }

    run.status = 'rolled-back';
    log(run, 'success', 'Rollback finished.');
  } catch (error) {
    run.status = settled;
    log(run, 'error', `Rollback failed: ${describe(error)}`);
    throw error;
  }

  return run;
};

const restoreRows = async (
  run: TRun,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  collection: string,
  rows: TRow[],
): Promise<TRow[]> => {
  if (isSingletonCollection(snapshot, collection)) {
    if (rows[0]) {
      await to.request(updateSingleton(collection, withoutAuditUsers(rows[0])));
      log(run, 'info', `${collection}: restored`);
    }

    return [];
  }

  const primaryKey = primaryKeyOf(snapshot, collection);
  const columns = realColumnsOf(snapshot, collection);
  const current = await readTargetRows(to, snapshot, collection);

  // Run the other way round: the backup is the "source" the target must match.
  const { newRows: deleted, changedRows } = diffRows({
    primaryKey,
    columns,
    sourceRows: rows,
    targetRows: current,
    excluded: new Set(),
    mirror: false,
  });

  await createRows(
    to,
    collection,
    primaryKey,
    deleted.map((row) => ({ [primaryKey]: row[primaryKey] })),
    () => undefined,
  );

  for (const batch of chunkArray(
    [...deleted, ...changedRows].map(withoutAuditUsers),
    WRITE_BATCH_SIZE,
  )) {
    await updateRows(to, collection, primaryKey, batch);
  }

  if (deleted.length + changedRows.length > 0) {
    log(
      run,
      'info',
      `${collection}: recreated ${deleted.length} deleted rows, ` +
        `restored ${changedRows.length} changed rows`,
    );
  }

  return current;
};

const removeCreated = async (
  run: TRun,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  collection: string,
  keys: string[],
  backedUp: TRow[] | undefined,
  current: TRow[] | undefined,
) => {
  if (keys.length === 0) return;

  // Deleting a file through Directus deletes its stored bytes too, and those
  // are shared with the source — the metadata row is the lesser evil.
  if (isSystemName(collection)) {
    log(
      run,
      'warn',
      `${collection}: ${keys.length} row(s) this run created were left in place`,
    );
    return;
  }

  const primaryKey = primaryKeyOf(snapshot, collection);
  const original = new Set(
    (backedUp ?? []).map((row) => String(row[primaryKey])),
  );
  const present = new Set(
    (current ?? []).map((row) => String(row[primaryKey])),
  );

  const doomed = keys.filter((key) => present.has(key) && !original.has(key));

  for (const batch of chunkArray(doomed, WRITE_BATCH_SIZE)) {
    await withRetry(() => to.request(deleteItems(collection, batch)));
  }

  run.createdKeys[collection] = [];
  log(run, 'info', `${collection}: removed ${doomed.length} created rows`);
};
