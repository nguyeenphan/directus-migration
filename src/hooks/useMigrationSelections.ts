'use client';

import { useState } from 'react';

import type { TPlan, TRecordExclusions } from '@/models/plan';

export const useMigrationSelections = () => {
  const [schema, setSchema] = useState<Set<string>>(() => new Set());
  const [applySchema, setApplySchema] = useState(true);
  const [data, setData] = useState<Set<string>>(() => new Set());
  const [excluded, setExcluded] = useState<TRecordExclusions>({});
  const [mirrorData, setMirrorData] = useState(false);

  return {
    schema,
    applySchema,
    data,
    excluded,
    mirrorData,

    setSchema,
    setApplySchema,
    setData,
    setExcluded,
    setMirrorData,

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
      setExcluded({});
      setMirrorData(false);
    },
  };
};
