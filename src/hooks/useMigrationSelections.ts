'use client';

import { useState } from 'react';

import type { TPlan, TRecordPicks } from '@/models/plan';

export const useMigrationSelections = () => {
  const [schema, setSchema] = useState<Set<string>>(new Set());
  const [applySchema, setApplySchema] = useState(true);
  const [data, setData] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<TRecordPicks>({});
  const [mirrorData, setMirrorData] = useState(false);

  return {
    schema,
    applySchema,
    data,
    records,
    mirrorData,

    setSchema,
    setApplySchema,
    setData,
    setRecords,
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
      setRecords({});
      setMirrorData(false);
    },
  };
};
