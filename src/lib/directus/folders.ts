import type { TRow } from '@/models/common';

export const inParentOrder = (folders: TRow[]) => {
  const ids = new Set(folders.map((folder) => String(folder.id)));
  const children = new Map<string, TRow[]>();
  const roots: TRow[] = [];

  for (const folder of folders) {
    const parent = folder.parent ? String(folder.parent) : null;

    if (parent === null || !ids.has(parent)) {
      roots.push(folder);
      continue;
    }

    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }

  const ordered: TRow[] = [];
  const written = new Set<string>();

  for (const root of roots) {
    const stack = [root];

    while (stack.length > 0) {
      const folder = stack.pop();
      if (!folder) break;

      const id = String(folder.id);
      if (written.has(id)) continue;

      written.add(id);
      ordered.push(folder);
      stack.push(...(children.get(id) ?? []));
    }
  }

  return [
    ...ordered,
    ...folders.filter((folder) => !written.has(String(folder.id))),
  ];
};
