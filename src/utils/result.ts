import type { TResult } from '@/models/common';

const describe = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'errors' in error) {
    const [first] = (error as { errors?: { message?: string }[] }).errors ?? [];
    if (first?.message) return first.message;
  }
  return error instanceof Error ? error.message : String(error);
};

export const withResult = async <T>(
  run: () => Promise<T>,
): Promise<TResult<T>> => {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
};
