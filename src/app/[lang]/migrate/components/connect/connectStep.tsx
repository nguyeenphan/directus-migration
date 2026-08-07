'use client';

import { ArrowLeftRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection, TSide } from '@/models/connection';
import type { TProbeResult } from '@/models/probe';
import type { TVersionDrift } from '@/utils/version';

import { ConnectionCard } from './connection/connectionCard';
import { RelaxBanner } from './gate/relaxBanner';
import { VersionGate } from './gate/versionGate';

type TProps = {
  source: TConnection;
  target: TConnection;
  probes: Record<TSide, TProbeResult | null>;
  drift: TVersionDrift;
  vendorMismatch: boolean;
  force: boolean;
  canContinue: boolean;
  isPlanning: boolean;
  planError: string | null;
  onChange: (side: TSide, connection: TConnection) => void;
  onProbe: (side: TSide, result: TProbeResult | null) => void;
  onForceChange: (force: boolean) => void;
  onSwap: () => void;
  onContinue: () => void;
};

export const ConnectStep = ({
  source,
  target,
  probes,
  drift,
  vendorMismatch,
  force,
  canContinue,
  isPlanning,
  planError,
  onChange,
  onProbe,
  onForceChange,
  onSwap,
  onContinue,
}: TProps) => {
  const translate = useTranslate();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-xl font-semibold">{translate('connect-title')}</h1>
        <p className="text-sm text-muted-foreground">
          {translate('connect-description')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <ConnectionCard
          caption={translate('env-source')}
          connection={source}
          probe={probes.source}
          onChange={(next) => onChange('source', next)}
          onProbe={(result) => onProbe('source', result)}
        />

        <div className="flex items-center justify-center">
          <Button variant="outline" onClick={onSwap} className="gap-2">
            <ArrowLeftRight className="size-4" />
            {translate('env-swap')}
          </Button>
        </div>

        <ConnectionCard
          caption={translate('env-target')}
          connection={target}
          probe={probes.target}
          onChange={(next) => onChange('target', next)}
          onProbe={(result) => onProbe('target', result)}
        />
      </div>

      <RelaxBanner target={target} canRepair={Boolean(probes.target?.ok)} />

      {probes.source?.ok && probes.target?.ok && (
        <VersionGate
          drift={drift}
          vendorMismatch={vendorMismatch}
          sourceVersion={probes.source.probe.version}
          targetVersion={probes.target.probe.version}
          force={force}
          onForceChange={onForceChange}
        />
      )}

      {planError && (
        <div className="border-2 border-destructive p-3">
          <p className="font-semibold text-destructive">
            {translate('plan-failed')}
          </p>
          <pre className="identifier mt-1 overflow-x-auto text-sm">
            {planError}
          </pre>
        </div>
      )}

      <div className="flex justify-end items-center gap-3">
        <Button
          size="lg"
          disabled={!canContinue || isPlanning}
          onClick={onContinue}
          className="gap-2"
        >
          {isPlanning && <Loader2 className="size-4 animate-spin" />}
          {translate(isPlanning ? 'plan-building' : 'connect-continue')}
        </Button>
      </div>
    </div>
  );
};
