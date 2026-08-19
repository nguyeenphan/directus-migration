'use client';

import { useState } from 'react';

import { generateSqlScript } from '@/app/[lang]/migrate/operations';
import type { TConnection } from '@/models/connection';
import type { TDataChange } from '@/models/plan';

type TState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; sql: string }
  | { phase: 'error'; error: string };

export const useSqlScript = (source: TConnection, target: TConnection) => {
  const [state, setState] = useState<TState>({ phase: 'idle' });

  const generate = async (
    rows: TDataChange[],
    selection: ReadonlySet<string>,
    mirrorData: boolean,
  ) => {
    setState({ phase: 'loading' });

    const result = await generateSqlScript(
      source,
      target,
      rows,
      [...selection],
      mirrorData,
    );

    setState(
      result.ok
        ? { phase: 'ready', sql: result.data }
        : { phase: 'error', error: result.error },
    );

    return result.ok;
  };

  return {
    phase: state.phase,
    sql: state.phase === 'ready' ? state.sql : '',
    error: state.phase === 'error' ? state.error : '',
    generate,
  };
};
