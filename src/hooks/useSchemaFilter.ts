'use client';

import { useMemo, useState } from 'react';

import {
  relationName,
  type TSchemaFilter,
  type TSchemaPlan,
} from '@/models/plan';

export const useSchemaFilter = (plan: TSchemaPlan) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TSchemaFilter>('all');
  const [showUnchanged, setShowUnchanged] = useState(false);

  const needle = query.trim().toLowerCase();

  const collections = useMemo(
    () =>
      plan.collections
        .filter((entry) => filter === 'all' || entry.kind === filter)
        .filter((entry) => entry.collection.toLowerCase().includes(needle)),
    [plan.collections, filter, needle],
  );

  const relations = useMemo(
    () =>
      plan.relations.filter((relation) =>
        relationName(relation).toLowerCase().includes(needle),
      ),
    [plan.relations, needle],
  );

  const unchanged = useMemo(
    () => plan.unchanged.filter((name) => name.toLowerCase().includes(needle)),
    [plan.unchanged, needle],
  );

  return {
    query,
    filter,
    showUnchanged,
    collections,
    relations,
    unchanged,

    setQuery,
    setFilter,
    toggleUnchanged: () => setShowUnchanged((current) => !current),
  };
};
