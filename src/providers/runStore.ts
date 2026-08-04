import type { TConnection } from '@/models/connection';
import type { TBackup, TRun } from '@/models/run';

type TRunSecrets = { source: TConnection; target: TConnection };

const globalStore = globalThis as typeof globalThis & {
  __directusMigration?: {
    runs: Map<string, TRun>;
    backups: Map<string, TBackup>;
    secrets: Map<string, TRunSecrets>;
  };
};

const store = (globalStore.__directusMigration ??= {
  runs: new Map<string, TRun>(),
  backups: new Map<string, TBackup>(),
  secrets: new Map<string, TRunSecrets>(),
});

const MAX_RUNS = 20;

export const putRun = (run: TRun) => {
  store.runs.set(run.id, run);

  while (store.runs.size > MAX_RUNS) {
    const [oldest] = store.runs.keys();
    store.runs.delete(oldest);
    store.backups.delete(oldest);
    store.secrets.delete(oldest);
  }

  return run;
};

export const getRun = (id: string) => store.runs.get(id) ?? null;

export const listRuns = () =>
  [...store.runs.values()].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );

export const putBackup = (id: string, backup: TBackup) =>
  store.backups.set(id, backup);

export const getBackup = (id: string) => store.backups.get(id) ?? null;

export const putSecrets = (id: string, secrets: TRunSecrets) =>
  store.secrets.set(id, secrets);

export const getSecrets = (id: string) => store.secrets.get(id) ?? null;
