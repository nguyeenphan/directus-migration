'use client';

import { useState, useTransition } from 'react';

import { loadRecordChanges } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TRecordChange } from '@/models/plan';

type TDetail =
  | { phase: 'loading' }
  | { phase: 'loaded'; records: TRecordChange[] }
  | { phase: 'error'; error: string };

export const useRecordBrowser = (source: TConnection, target: TConnection) => {
  const [active, setActive] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, TDetail>>({});
  const [, startLoading] = useTransition();

  const detail = active ? details[active] : undefined;
  const records = detail?.phase === 'loaded' ? detail.records : [];

  const index = records.findIndex((record) => record.key === activeKey);

  const load = (collection: string) => {
    setDetails((current) => ({
      ...current,
      [collection]: { phase: 'loading' },
    }));

    startLoading(async () => {
      const result = await loadRecordChanges(source, target, collection);

      setDetails((current) => ({
        ...current,
        [collection]: result.ok
          ? { phase: 'loaded', records: result.data }
          : { phase: 'error', error: result.error },
      }));
    });
  };

  const inspect = (collection: string) => {
    setActive(collection);
    setActiveKey(null);
    if (!details[collection]) load(collection);
  };

  return {
    active,
    activeKey,
    detail,
    records,
    index,
    record: index >= 0 ? records[index] : null,

    inspect,
    reload: () => active && load(active),
    select: setActiveKey,
    step: (delta: number) => {
      const next = records[index + delta];
      if (next) setActiveKey(next.key);
    },
  };
};
