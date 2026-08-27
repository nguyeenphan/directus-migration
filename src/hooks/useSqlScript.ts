'use client';

import { useState } from 'react';

import type { TResult } from '@/models/common';

type TState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; sql: string }
  | { phase: 'error'; error: string };

export type TSqlGenerator = (
  onLog: (line: string) => void,
) => Promise<TResult<string>>;

export const useSqlScript = () => {
  const [state, setState] = useState<TState>({ phase: 'idle' });
  const [log, setLog] = useState<string[]>([]);

  const generate = async (run: TSqlGenerator) => {
    setState({ phase: 'loading' });
    setLog([]);

    const result = await run((line) => setLog((lines) => [...lines, line]));

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
    log,
    generate,
  };
};
