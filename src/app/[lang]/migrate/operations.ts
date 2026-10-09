import { clientFor } from '@/lib/directus/client';
import { restoreConstraints } from '@/lib/directus/constraints';
import { getRecordChanges } from '@/lib/directus/detail';
import { buildPlan } from '@/lib/directus/plan';
import { probeConnection } from '@/lib/directus/probe';
import {
  settlePendingRelax,
  type TPendingRelax,
} from '@/lib/store/constraints';
import { getBackup, getRun } from '@/lib/store/runs';
import type { TResult } from '@/models/common';
import { parseConnection } from '@/models/connection';
import type { TDryRunReport } from '@/models/dryRun';
import type {
  TDataChange,
  TPlan,
  TRecordChange,
  TRecordExclusions,
} from '@/models/plan';
import type { TProbeResult } from '@/models/probe';
import type { TRun } from '@/models/run';
import { describeError } from '@/utils/describeError';
import { withResult } from '@/utils/result';

// Loaded when first needed: the connect step only ever probes, and the runner
// and the SQL generators are most of this module's weight.
const loadRunner = () => import('@/lib/directus/runner');

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
  excluded: TRecordExclusions,
): Promise<TResult<TDryRunReport>> {
  const { dryRun } = await import('@/lib/directus/dryRun');

  return dryRun(
    parseConnection(source),
    parseConnection(target),
    collections,
    schemaChanges,
    excluded,
  );
}

export async function beginRun({
  source,
  target,
  collections,
  excluded,
  applySchema,
  schemaCollections,
  force,
  mirrorData,
}: {
  source: unknown;
  target: unknown;
  collections: string[];
  excluded?: TRecordExclusions;
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

  const { startRun } = await loadRunner();

  const run = startRun({
    source: from,
    target: to,
    collections,
    excluded: excluded ?? {},
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

export async function confirmBackup(id: string): Promise<TRun | null> {
  const run = getRun(id);
  if (!run) return null;

  const { resumeAfterBackup } = await loadRunner();
  return snapshot(resumeAfterBackup(run));
}

export async function stopRun(id: string): Promise<TRun | null> {
  const run = getRun(id);
  if (!run) return null;

  const { requestStop } = await loadRunner();
  return snapshot(requestStop(run));
}

export async function rollback(id: string): Promise<TResult<TRun>> {
  const run = getRun(id);
  if (!run) return { ok: false, error: 'Run not found' };

  try {
    const { rollbackRun } = await loadRunner();

    return { ok: true, data: snapshot(await rollbackRun(run)) };
  } catch (error) {
    return {
      ok: false,
      error: describeError(error),
    };
  }
}

export async function repairRelax(
  connection: unknown,
  pending: TPendingRelax,
): Promise<TResult<number>> {
  return withResult(async () => {
    const failures = await restoreConstraints(
      clientFor(parseConnection(connection)),
      pending.fields,
    );

    // What was restored is done with; only the stragglers stay on record.
    settlePendingRelax(
      pending.runId,
      failures.map((failure) => failure.field),
    );

    if (failures.length > 0) throw failures[0].error;

    return pending.fields.length;
  });
}

export async function generateSqlScript(
  source: unknown,
  target: unknown,
  rows: TDataChange[],
  selection: string[],
  mirrorData: boolean,
  excluded: TRecordExclusions,
  onLog?: (line: string) => void,
): Promise<TResult<string>> {
  // Loaded on demand: the generators are only needed once a script is asked for.
  const { buildSqlScript } = await import('@/lib/directus/sqlScript');

  return buildSqlScript(
    parseConnection(source),
    parseConnection(target),
    rows,
    new Set(selection),
    mirrorData,
    excluded,
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
  const { buildSchemaSqlScript } = await import('@/lib/directus/schemaSql');

  return buildSchemaSqlScript(
    parseConnection(source),
    parseConnection(target),
    force,
    new Set(selection),
    onLog,
  );
}
