'use client';

import { useState } from 'react';

import type { TPlan } from '@/models/plan';

export const useMigrationSelections = () => {
  const [schema, setSchema] = useState<Set<string>>(new Set());
  const [applySchema, setApplySchema] = useState(true);
  const [data, setData] = useState<Set<string>>(new Set());
  const [confirmedSql, setConfirmedSql] = useState('');

  return {
    schema,
    applySchema,
    data,
    confirmedSql,

    setSchema,
    setApplySchema,
    setData,
    setConfirmedSql,

    resetFor: (plan: TPlan) => {
      setSchema(
        new Set(plan.schema.collections.map((entry) => entry.collection)),
      );
      setData(
        new Set(
          plan.data
            .filter((row) => row.toCreate > 0 || (row.toUpdate ?? 0) > 0)
            .map((row) => row.collection),
        ),
      );
      setConfirmedSql('');
    },
  };
};
