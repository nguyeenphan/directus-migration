'use client';

import { useState, useTransition } from 'react';

import { createPlan } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TStep } from '@/models/flow';
import type { TPlan } from '@/models/plan';

export const usePlan = ({
  source,
  target,
  force,
  fingerprint,
  onAdopted,
}: {
  source: TConnection;
  target: TConnection;
  force: boolean;
  fingerprint: string;
  onAdopted: (plan: TPlan, openAt: TStep) => void;
}) => {
  const [plan, setPlan] = useState<TPlan | null>(null);
  const [builtFor, setBuiltFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [openTarget, setOpenTarget] = useState<TStep>('schema');
  const [isBuilding, startBuilding] = useTransition();

  const [drift, setDrift] = useState<{ plan: TPlan; for: string } | null>(null);

  const adopt = (next: TPlan, openAt: TStep, pairedWith: string) => {
    setPlan(next);
    setBuiltFor(pairedWith);
    onAdopted(next, openAt);
  };

  const build = (openAt: TStep) => {
    setError(null);
    setLog([]);
    setShowLog(true);
    setOpenTarget(openAt);

    const pairedWith = fingerprint;

    startBuilding(async () => {
      const result = await createPlan(source, target, force, (line) =>
        setLog((current) => [...current, line]),
      );

      if (!result.ok) return setError(result.error);

      setShowLog(false);

      if (openAt === 'data' && result.data.schema.collections.length > 0) {
        setDrift({ plan: result.data, for: pairedWith });
        return;
      }

      adopt(result.data, openAt, pairedWith);
    });
  };

  return {
    plan,
    builtFor,
    error,
    log,
    showLog,
    openTarget,
    isBuilding,
    drift,

    build,
    closeLog: () => setShowLog(false),
    resolveDrift: (openAt: TStep) => {
      if (!drift) return;

      setDrift(null);
      adopt(drift.plan, openAt, drift.for);
    },
    reset: () => {
      setPlan(null);
      setBuiltFor('');
      setDrift(null);
    },
  };
};
