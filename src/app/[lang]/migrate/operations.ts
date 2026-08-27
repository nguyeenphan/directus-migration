import { clientFor } from '@/lib/directus/client';
import { restoreConstraints } from '@/lib/directus/constraints';
import { getRecordChanges } from '@/lib/directus/detail';
import { dryRun } from '@/lib/directus/dryRun';
import { buildPlan } from '@/lib/directus/plan';
import { probeConnection } from '@/lib/directus/probe';
import { requestStop, rollbackRun, startRun } from '@/lib/directus/runner';
import { buildSchemaSqlScript } from '@/lib/directus/schemaSql';
import { buildSqlScript } from '@/lib/directus/sqlScript';
import { clearPendingRelax, type TPendingRelax } from '@/lib/store/constraints';
import { getBackup, getRun } from '@/lib/store/runs';
import type { TResult } from '@/models/common';
import { parseConnection } from '@/models/connection';
import type { TDryRunReport } from '@/models/dryRun';
import type {
  TDataChange,
  TPlan,
  TRecordChange,
  TRecordPicks,
} from '@/models/plan';
import type { TProbeResult } from '@/models/probe';
import type { TRun } from '@/models/run';
import { withResult } from '@/utils/result';

export async function testConnection(
  connection: unknown,
): Promise<TProbeResult> {
  try {
    return await probeConnection(parseConnection(connection));
  } catch (error) {
    return {
      ok: false,
      reason: 'unreachable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createPlan(
  source: unknown,
  target: unknown,
  force: boolean,
  onLog?: (line: string) => void,
): Promise<TResult<TPlan>> {
  return buildPlan(
    parseConnection(source),
    parseConnection(target),
    force,
    onLog,
  );
}

export async function loadRecordChanges(
  source: unknown,
  target: unknown,
  collection: string,
): Promise<TResult<TRecordChange[]>> {
  return getRecordChanges(
    parseConnection(source),
    parseConnection(target),
    collection,
  );
}

export async function runDryRun(
  source: unknown,
  target: unknown,
  collections: string[],
  schemaChanges: number,
  records: TRecordPicks,
): Promise<TResult<TDryRunReport>> {
  return dryRun(
    parseConnection(source),
    parseConnection(target),
    collections,
    schemaChanges,
    records,
  );
}

export async function beginRun({
  source,
  target,
  collections,
  records,
  applySchema,
  schemaCollections,
  force,
  mirrorData,
}: {
  source: unknown;
  target: unknown;
  collections: string[];
  records?: TRecordPicks;
  applySchema: boolean;
  schemaCollections: string[];
  force: boolean;
  mirrorData: boolean;
}): Promise<{ id: string }> {
  const from = parseConnection(source);
  const to = parseConnection(target);

  if (!applySchema && collections.length === 0) {
    throw new Error('Nothing selected to run');
  }

  const run = startRun({
    source: from,
    target: to,
    collections,
    records: records ?? {},
    applySchema,
    schemaCollections,
    force,
    mirrorData,
  });

  return { id: run.id };
}

const snapshot = (run: TRun): TRun => structuredClone(run);

export async function readRun(id: string): Promise<TRun | null> {
  const run = getRun(id);
  return run ? snapshot(run) : null;
}

export async function stopRun(id: string): Promise<TRun | null> {
  const run = getRun(id);
  return run ? snapshot(requestStop(run)) : null;
}

export async function rollback(id: string): Promise<TResult<TRun>> {
  const run = getRun(id);
  if (!run) return { ok: false, error: 'Run not found' };

  try {
    return { ok: true, data: snapshot(await rollbackRun(run)) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function repairRelax(
  connection: unknown,
  pending: TPendingRelax,
): Promise<TResult<number>> {
  return withResult(async () => {
    await restoreConstraints(
      clientFor(parseConnection(connection)),
      pending.fields,
    );
    clearPendingRelax(pending.runId);

    return pending.fields.length;
  });
}

export async function generateSqlScript(
  source: unknown,
  target: unknown,
  rows: TDataChange[],
  selection: string[],
  mirrorData: boolean,
  records: TRecordPicks,
  onLog?: (line: string) => void,
): Promise<TResult<string>> {
  return buildSqlScript(
    parseConnection(source),
    parseConnection(target),
    rows,
    new Set(selection),
    mirrorData,
    records,
    onLog,
  );
}

export async function readBackup(id: string): Promise<string | null> {
  const backup = getBackup(id);
  return backup ? JSON.stringify(backup, null, 2) : null;
}

export async function generateSchemaSqlScript(
  source: unknown,
  target: unknown,
  force: boolean,
  selection: string[],
  onLog?: (line: string) => void,
): Promise<TResult<string>> {
  return buildSchemaSqlScript(
    parseConnection(source),
    parseConnection(target),
    force,
    new Set(selection),
    onLog,
  );
}
