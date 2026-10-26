import type { TRow } from '@/models/common';

export const inParentOrder = (
  rows: TRow[],
  key = 'id',
  parentKey = 'parent',
) => {
  const ids = new Set(rows.map((row) => String(row[key])));
  const children = new Map<string, TRow[]>();
  const roots: TRow[] = [];

  for (const row of rows) {
    const parent = row[parentKey] ? String(row[parentKey]) : null;

    if (parent === null || !ids.has(parent)) {
      roots.push(row);
      continue;
    }

    children.set(parent, [...(children.get(parent) ?? []), row]);
  }

  const ordered: TRow[] = [];
  const written = new Set<string>();

  for (const root of roots) {
    const stack = [root];

    while (stack.length > 0) {
      const row = stack.pop();
      if (!row) break;

      const id = String(row[key]);
      if (written.has(id)) continue;

      written.add(id);
      ordered.push(row);
      stack.push(...(children.get(id) ?? []));
    }
  }

  return [...ordered, ...rows.filter((row) => !written.has(String(row[key])))];
};
