export type TDiffOp = { type: 'same' | 'add' | 'del'; text: string };

export type TDiffLine = { ops: TDiffOp[]; changed: boolean };

export type TDiffBlock =
  { type: 'lines'; lines: TDiffLine[] } | { type: 'gap'; lines: TDiffLine[] };

const TOKEN = /\s+|[^\s]+/g;

const MAX_TOKENS = 2500;

export const wordDiff = (before: string, after: string): TDiffOp[] => {
  if (before === after) {
    return before ? [{ type: 'same', text: before }] : [];
  }

  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return merge([
      ...(before ? [{ type: 'del' as const, text: before }] : []),
      ...(after ? [{ type: 'add' as const, text: after }] : []),
    ]);
  }

  return merge(backtrack(a, b, lcsTable(a, b)));
};

const lcsTable = (a: string[], b: string[]) => {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  return table;
};

const backtrack = (a: string[], b: string[], table: Uint32Array) => {
  const width = b.length + 1;
  const ops: TDiffOp[] = [];

  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: 'del', text: a[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', text: b[j] });
      j += 1;
    }
  }

  while (i < a.length) ops.push({ type: 'del', text: a[i++] });
  while (j < b.length) ops.push({ type: 'add', text: b[j++] });

  return ops;
};

const merge = (ops: TDiffOp[]) =>
  ops.reduce<TDiffOp[]>((merged, op) => {
    const last = merged.at(-1);

    if (last?.type === op.type) last.text += op.text;
    else merged.push({ ...op });

    return merged;
  }, []);

export const toDiffLines = (ops: TDiffOp[]): TDiffLine[] => {
  const lines: TDiffLine[] = [{ ops: [], changed: false }];

  for (const op of ops) {
    const pieces = op.text.split('\n');

    pieces.forEach((piece, index) => {
      if (index > 0) lines.push({ ops: [], changed: false });

      const line = lines.at(-1)!;
      if (piece) line.ops.push({ type: op.type, text: piece });
      if (op.type !== 'same') line.changed = true;
    });
  }

  return lines;
};

export const collapseUnchanged = (
  lines: TDiffLine[],
  context = 2,
): TDiffBlock[] => {
  const keep = new Set<number>();

  lines.forEach((line, index) => {
    if (!line.changed) return;

    for (let near = index - context; near <= index + context; near += 1) {
      if (near >= 0 && near < lines.length) keep.add(near);
    }
  });

  if (keep.size === 0) return [{ type: 'lines', lines }];

  const blocks: TDiffBlock[] = [];

  for (const [index, line] of lines.entries()) {
    const type = keep.has(index) ? 'lines' : 'gap';
    const last = blocks.at(-1);

    if (last?.type === type) last.lines.push(line);
    else blocks.push({ type, lines: [line] });
  }

  return blocks.map((block) =>
    block.type === 'gap' && block.lines.length <= context
      ? { type: 'lines', lines: block.lines }
      : block,
  );
};
