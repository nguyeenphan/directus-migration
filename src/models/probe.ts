export type TProbe = {
  version: string | null;

  vendor: string | null;
  collectionCount: number;

  isAdmin: boolean;
  roleName: string | null;
};

export type TProbeFailure =
  'unreachable' | 'not-directus' | 'unauthorised' | 'forbidden' | 'timeout';

export type TProbeResult =
  | { ok: true; probe: TProbe }
  | { ok: false; reason: TProbeFailure; detail: string };
