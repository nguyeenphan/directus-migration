'use client';

import { useState } from 'react';

import {
  emptyConnection,
  fingerprintOf,
  type TConnection,
  type TSide,
} from '@/models/connection';
import type { TProbeResult } from '@/models/probe';
import { compareVersions, isDriftPassable } from '@/utils/version';

export const useConnections = () => {
  const [source, setSource] = useState<TConnection>(emptyConnection());
  const [target, setTarget] = useState<TConnection>(emptyConnection());
  const [probes, setProbes] = useState<Record<TSide, TProbeResult | null>>({
    source: null,
    target: null,
  });
  const [force, setForce] = useState(false);

  const drift = compareVersions(
    probes.source?.ok ? probes.source.probe.version : null,
    probes.target?.ok ? probes.target.probe.version : null,
  );

  const vendorMismatch = Boolean(
    probes.source?.ok &&
    probes.target?.ok &&
    probes.source.probe.vendor !== probes.target.probe.vendor,
  );

  const canLeaveConnect = Boolean(
    probes.source?.ok &&
    probes.target?.ok &&
    !vendorMismatch &&
    isDriftPassable(drift) &&
    (drift !== 'patch' || force),
  );

  return {
    source,
    target,
    probes,
    force,
    drift,
    vendorMismatch,
    canLeaveConnect,
    fingerprint: fingerprintOf(source, target),

    setForce,
    change: (side: TSide, connection: TConnection) =>
      side === 'source' ? setSource(connection) : setTarget(connection),
    probed: (side: TSide, result: TProbeResult | null) =>
      setProbes((current) => ({ ...current, [side]: result })),
    swap: () => {
      setSource(target);
      setTarget(source);
      setProbes({ source: probes.target, target: probes.source });
    },
  };
};
