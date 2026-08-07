import { RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from '@/constants/run';

const TRANSIENT_STATUS = [408, 429] as const;

const statusOf = (error: unknown) => {
  const response = (error as { response?: { status?: unknown } } | null)
    ?.response;

  return typeof response?.status === 'number' ? response.status : null;
};

export const isTransient = (error: unknown) => {
  if (error instanceof TypeError) return true;

  const status = statusOf(error);
  if (status === null) return false;

  return status >= 500 || TRANSIENT_STATUS.includes(status as 408 | 429);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async <T>(
  work: () => Promise<T>,
  attempts: number = RETRY_ATTEMPTS,
): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isTransient(error)) throw error;

      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
};
