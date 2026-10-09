import type { TChangeKind } from '@/models/plan';

export type TPlanLogLine = {
  collection: string | null;
  text: string;
  counts: { kind: TChangeKind; label: string; isZero: boolean }[];
};

const COLLECTION = /^([^\s:]+)(: .*)$/;
const COUNTS = /^(.* — )\+(\d+) ~(\d+|\?) -(\d+)$/;

/**
 * Splits a comparison log line into the parts the dialog styles apart: a
 * leading `collection:` name and a trailing `+N ~N -N` summary. Joining the
 * parts back gives the original line, so copying the log is unaffected.
 */
export const parsePlanLogLine = (line: string): TPlanLogLine => {
  const named = COLLECTION.exec(line);
  const rest = named ? named[2] : line;
  const tail = COUNTS.exec(rest);

  if (!tail) return { collection: named?.[1] ?? null, text: rest, counts: [] };

  const [, text, added, modified, deleted] = tail;

  return {
    collection: named?.[1] ?? null,
    text,
    counts: [
      { kind: 'add', label: `+${added}`, isZero: added === '0' },
      { kind: 'modify', label: `~${modified}`, isZero: modified === '0' },
      { kind: 'delete', label: `-${deleted}`, isZero: deleted === '0' },
    ],
  };
};
