/**
 * Directus answers a read of a collection it does not have with FORBIDDEN, the
 * same code it uses for a permission it will not grant. Callers that can carry
 * on without the collection use `orMissing`; everything else still throws.
 */
export const isMissingCollection = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;

  const { errors, response } = error as {
    errors?: { extensions?: { code?: string } }[];
    response?: { status?: number };
  };

  return (
    response?.status === 403 || errors?.[0]?.extensions?.code === 'FORBIDDEN'
  );
};

export const orMissing = async <T>(promise: Promise<T>): Promise<T | null> => {
  try {
    return await promise;
  } catch (error) {
    if (isMissingCollection(error)) return null;
    throw error;
  }
};
