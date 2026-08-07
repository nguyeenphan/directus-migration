import type { TRelaxedField } from '@/api/constraints';
import { PENDING_RELAX_KEY } from '@/constants/storage';

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

export const putPendingRelax = (entry: TPendingRelax) =>
  write([...read().filter((held) => held.runId !== entry.runId), entry]);

export const clearPendingRelax = (runId: string) =>
  write(read().filter((held) => held.runId !== runId));
