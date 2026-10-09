type TDirectusError = {
  message?: string;
  extensions?: Record<string, unknown>;
};

/**
 * The first error of a Directus response, if that is what was thrown. The SDK
 * puts whatever it could not parse into `errors` — a string, a SyntaxError —
 * so that field is only trusted when it really is a list.
 */
export const firstDirectusError = (error: unknown): TDirectusError | null => {
  if (typeof error !== 'object' || error === null) return null;

  const { errors } = error as { errors?: unknown };
  if (!Array.isArray(errors)) return null;

  const [first] = errors as TDirectusError[];
  return typeof first?.message === 'string' ? first : null;
};

const fallback = (error: unknown) => {
  if (error instanceof Error) return error.message;

  const { errors } = (error ?? {}) as { errors?: unknown };
  if (errors instanceof Error) return errors.message;
  if (typeof errors === 'string' && errors) return errors;

  return String(error);
};

export const describeError = (error: unknown): string =>
  firstDirectusError(error)?.message ?? fallback(error);

// With the error code and whatever else Directus attached — for the run log.
export const describeErrorInDetail = (error: unknown): string => {
  const first = firstDirectusError(error);
  if (!first) return fallback(error);

  const { code, ...rest } = first.extensions ?? {};
  const detail = Object.entries(rest)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');

  return [first.message, code, detail].filter(Boolean).join(' | ');
};
