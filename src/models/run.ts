import { RUN_STAGES } from '@/constants/run';

import type { TRow } from './common';
import type { TConnection } from './connection';

export type TStage = (typeof RUN_STAGES)[number];

export type TUnitStatus = 'pending' | 'running' | 'done' | 'failed';

export type TRunUnit = {
  name: string;
  stage: TStage;
  status: TUnitStatus;

  written: number;
  deleted: number;
  error: string | null;
};

export type TLogLevel = 'info' | 'success' | 'warn' | 'error';

export type TLogLine = {
  at: string;
  level: TLogLevel;
  message: string;
};

export type TRunStatus =
  'running' | 'succeeded' | 'partial' | 'failed' | 'stopped' | 'rolled-back';

export const RUN_STATUS_LEVEL: Record<TRunStatus, TLogLevel> = {
  running: 'info',
  succeeded: 'success',
  partial: 'warn',
  failed: 'error',
  stopped: 'warn',
  'rolled-back': 'warn',
};

export type TRunRequest = {
  source: TConnection;
  target: TConnection;
  collections: string[];
  applySchema: boolean;
  schemaCollections: string[];
  force: boolean;

  mirrorData: boolean;
};

export type TBackup = {
  capturedAt: string;

  snapshot: unknown;

  rows: Record<string, TRow[]>;
};

export type TSequenceReset = {
  collection: string;
  primaryKey: string;
};

export type TRun = {
  id: string;
  sourceHost: string;
  targetHost: string;
  status: TRunStatus;
  startedAt: string;
  finishedAt: string | null;
  units: TRunUnit[];
  log: TLogLine[];

  stopRequested: boolean;

  sequenceResets: TSequenceReset[];

  hasBackup: boolean;

  createdKeys: Record<string, string[]>;
};

export const sequenceResetSql = (resets: TSequenceReset[]) =>
  resets
    .map(
      ({ collection, primaryKey }) =>
        `SELECT setval(pg_get_serial_sequence('"${collection}"', '${primaryKey}'), ` +
        `COALESCE((SELECT MAX("${primaryKey}") FROM "${collection}"), 1), ` +
        `(SELECT COUNT(*) FROM "${collection}") > 0);`,
    )
    .join('\n');

export const stageUnits = (run: TRun, stage: TStage) =>
  run.units.filter((unit) => unit.stage === stage);

export const wroteData = (run: TRun) => stageUnits(run, 'data').length > 0;

export const stageStatus = (run: TRun, stage: TStage): TUnitStatus => {
  const units = stageUnits(run, stage);

  if (units.length === 0) return 'pending';
  if (units.some((unit) => unit.status === 'failed')) return 'failed';
  if (units.every((unit) => unit.status === 'done')) return 'done';
  if (units.some((unit) => unit.status !== 'pending')) return 'running';

  return 'pending';
};

export const runProgress = (run: TRun) => {
  const settled = run.units.filter(
    (unit) => unit.status === 'done' || unit.status === 'failed',
  ).length;

  return {
    settled,
    total: run.units.length,
    percent: run.units.length === 0 ? 0 : (settled / run.units.length) * 100,
  };
};

export const failedUnits = (run: TRun) =>
  run.units.filter((unit) => unit.status === 'failed');

export const runOutcome = (run: TRun) => ({
  written: run.units.filter((unit) => unit.status === 'done'),
  failed: failedUnits(run),
  untouched: run.units.filter((unit) => unit.status === 'pending'),
});

export const isFinished = (run: TRun) => run.status !== 'running';
