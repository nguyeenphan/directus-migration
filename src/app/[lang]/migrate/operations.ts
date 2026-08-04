import { getRecordChanges } from '@/api/detail';
import { dryRun } from '@/api/dryRun';
import { buildPlan } from '@/api/plan';
import { probeConnection } from '@/api/probe';
import { requestStop, rollbackRun, startRun } from '@/api/runner';
import type { TResult } from '@/models/common';
import { parseConnection } from '@/models/connection';
import type { TDryRunReport } from '@/models/dryRun';
import type { TPlan, TRecordChange } from '@/models/plan';
import type { TProbeResult } from '@/models/probe';
import type { TRun } from '@/models/run';
import { getBackup, getRun } from '@/providers/runStore';

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
): Promise<TResult<TDryRunReport>> {
  return dryRun(
    parseConnection(source),
    parseConnection(target),
    collections,
    schemaChanges,
  );
}

export async function beginRun({
  source,
  target,
  collections,
  applySchema,
  schemaCollections,
  force,
}: {
  source: unknown;
  target: unknown;
  collections: string[];
  applySchema: boolean;
  schemaCollections: string[];
  force: boolean;
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
    applySchema,
    schemaCollections,
    force,
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

export async function readBackup(id: string): Promise<string | null> {
  const backup = getBackup(id);
  return backup ? JSON.stringify(backup, null, 2) : null;
}
