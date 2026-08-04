'use client';

import { useMemo, useState } from 'react';

import {
  groupCollections,
  isEmptyChange,
  type TDataChange,
} from '@/models/plan';

export const useCollectionFilter = (rows: TDataChange[]) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const needle = query.trim().toLowerCase();

  const { changed, skipped } = useMemo(() => {
    const changedRows = rows.filter((row) => !isEmptyChange(row));

    return {
      changed: groupCollections(changedRows).filter((group) =>
        group.parent.toLowerCase().includes(needle),
      ),
      skipped: rows.length - changedRows.length,
    };
  }, [rows, needle]);

  return {
    query,
    expanded,
    changed,
    skipped,

    setQuery,
    isExpanded: (parent: string) => expanded.has(parent),
    toggleExpand: (parent: string) =>
      setExpanded((current) => {
        const next = new Set(current);

        if (next.has(parent)) next.delete(parent);
        else next.add(parent);

        return next;
      }),
  };
};
