import type { TResult } from '@/models/common';

import { describeError } from './describeError';

export const withResult = async <T>(
  run: () => Promise<T>,
): Promise<TResult<T>> => {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
};
