'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { repairRelax } from '@/app/[lang]/migrate/operations';
import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/useTranslate';
import {
  listPendingRelax,
  serverPendingRelax,
  subscribeToPendingRelax,
  type TPendingRelax,
} from '@/lib/store/constraints';
import { hostOf, type TConnection } from '@/models/connection';

type TProps = {
  target: TConnection;
  canRepair: boolean;

  // Shown on a finished run rather than on a fresh visit.
  isUnrestored?: boolean;
};

export const RelaxBanner = ({
  target,
  canRepair,
  isUnrestored = false,
}: TProps) => {
  const translate = useTranslate();

  const pending = useSyncExternalStore(
    subscribeToPendingRelax,
    listPendingRelax,
    serverPendingRelax,
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const host = hostOf(target.url);
  const mine = pending.filter((entry) => entry.targetHost === host);

  if (mine.length === 0) return null;

  const repair = async (entry: TPendingRelax) => {
    setBusy(entry.runId);
    setError(null);

    const result = await repairRelax(target, entry);

    setBusy(null);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="rounded-base border-2 border-destructive bg-secondary-background p-3">
      <p className="flex items-center gap-2 font-heading text-destructive">
        <ShieldAlert className="size-4" />
        {translate('relax-pending-title')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {translate(
          isUnrestored
            ? 'relax-unrestored-description'
            : 'relax-pending-description',
        )}
      </p>

      {mine.map((entry) => (
        <div
          key={entry.runId}
          className="mt-2 flex items-center justify-between gap-3"
        >
          <span className="identifier text-sm">
            {entry.targetHost} — {entry.fields.length} ({entry.relaxedAt})
          </span>
          <Button
            variant="outline"
            disabled={!canRepair || busy !== null}
            onClick={() => repair(entry)}
            className="gap-2"
          >
            {busy === entry.runId && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {translate('relax-pending-repair')}
          </Button>
        </div>
      ))}

      {error && <pre className="identifier mt-2 text-sm">{error}</pre>}
    </div>
  );
};
