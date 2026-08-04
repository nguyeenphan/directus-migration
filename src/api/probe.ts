import { readMe, schemaSnapshot, serverInfo } from '@directus/sdk';

import { isSystemName } from '@/api';
import { PROBE_TIMEOUT_MS } from '@/constants/run';
import type { TConnection } from '@/models/connection';
import type { TProbeFailure, TProbeResult } from '@/models/probe';
import { clientFor } from '@/providers/directusClient';

export const probeConnection = async (
  connection: TConnection,
): Promise<TProbeResult> => {
  const client = clientFor(connection);

  try {
    const snapshot = await withTimeout(client.request(schemaSnapshot()));

    if (!snapshot?.collections) {
      return fail('not-directus', 'Response did not contain a Directus schema');
    }

    const [version, roleName] = await Promise.all([
      readServerVersion(client),
      readRoleName(client),
    ]);

    return {
      ok: true,
      probe: {
        version: snapshot.directus ?? version,
        vendor: snapshot.vendor ?? null,
        collectionCount: snapshot.collections.filter(
          (entry) => !isSystemName(String(entry.collection)),
        ).length,
        isAdmin: true,
        roleName,
      },
    };
  } catch (error) {
    return fail(classify(error), describe(error));
  }
};

const fail = (reason: TProbeFailure, detail: string): TProbeResult => ({
  ok: false,
  reason,
  detail,
});

const withTimeout = <T>(promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('TIMEOUT')),
        PROBE_TIMEOUT_MS,
      ).unref?.(),
    ),
  ]);

const readServerVersion = async (client: ReturnType<typeof clientFor>) => {
  try {
    const info = await client.request(serverInfo());
    return typeof info === 'object' && info && 'version' in info
      ? String((info as { version: unknown }).version)
      : null;
  } catch {
    return null;
  }
};

const readRoleName = async (client: ReturnType<typeof clientFor>) => {
  try {
    const me = await client.request<{ role?: { name?: string } | null }>(
      readMe({ fields: ['role.name'] }),
    );
    return me?.role?.name ?? null;
  } catch {
    return null;
  }
};

const statusOf = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return null;

  const { errors, response } = error as {
    errors?: { extensions?: { code?: string } }[];
    response?: { status?: number };
  };

  return {
    code: errors?.[0]?.extensions?.code ?? null,
    status: response?.status ?? null,
  };
};

const classify = (error: unknown): TProbeFailure => {
  if (error instanceof Error && error.message === 'TIMEOUT') return 'timeout';

  const { code, status } = statusOf(error) ?? { code: null, status: null };

  if (status === 401 || code === 'INVALID_CREDENTIALS') return 'unauthorised';
  if (status === 403 || code === 'FORBIDDEN') return 'forbidden';
  if (status === 404) return 'not-directus';
  if (status !== null && status >= 500) return 'not-directus';

  return 'unreachable';
};

const describe = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'errors' in error) {
    const [first] = (error as { errors?: { message?: string }[] }).errors ?? [];
    if (first?.message) return first.message;
  }

  return error instanceof Error ? error.message : String(error);
};
