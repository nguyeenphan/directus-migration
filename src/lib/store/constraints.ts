import { PENDING_RELAX_KEY } from '@/constants/storage';
import type { TRelaxedField } from '@/lib/directus/constraints';

export type TPendingRelax = {
  runId: string;

  targetHost: string;

  relaxedAt: string;

  fields: TRelaxedField[];
};

const read = (): TPendingRelax[] => {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_RELAX_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const EMPTY: TPendingRelax[] = [];

let snapshot: TPendingRelax[] | null = null;
const listeners = new Set<() => void>();

const write = (entries: TPendingRelax[]) => {
  if (typeof localStorage === 'undefined') return;

  localStorage.setItem(PENDING_RELAX_KEY, JSON.stringify(entries));
  snapshot = entries;

  for (const listener of listeners) listener();
};

export const listPendingRelax = () => (snapshot ??= read());

export const serverPendingRelax = () => EMPTY;

export const subscribeToPendingRelax = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const pendingRelaxFor = (targetHost: string): TRelaxedField[] =>
  read()
    .filter((held) => held.targetHost === targetHost)
    .flatMap((held) => held.fields);

// One entry per target: the caller has already folded what was outstanding
// for that host into `entry.fields`, so the older entries are subsumed.
export const putPendingRelax = (entry: TPendingRelax) =>
  write([
    ...read().filter((held) => held.targetHost !== entry.targetHost),
    entry,
  ]);

export const settlePendingRelax = (
  runId: string,
  stillRelaxed: TRelaxedField[],
) =>
  write(
    read().flatMap((held) => {
      if (held.runId !== runId) return [held];

      return stillRelaxed.length > 0 ? [{ ...held, fields: stillRelaxed }] : [];
    }),
  );
