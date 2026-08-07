'use client';

import { Check, TriangleAlert, X } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { useTranslate } from '@/hooks/useTranslate';
import type { TVersionDrift } from '@/utils/version';

import { StatusBanner } from './statusBanner';

type TProps = {
  drift: TVersionDrift;
  vendorMismatch: boolean;
  sourceVersion: string | null;
  targetVersion: string | null;
  force: boolean;
  onForceChange: (force: boolean) => void;
};

export const VersionGate = ({
  drift,
  vendorMismatch,
  sourceVersion,
  targetVersion,
  force,
  onForceChange,
}: TProps) => {
  const translate = useTranslate();
  const versions = {
    source: sourceVersion ?? '?',
    target: targetVersion ?? '?',
  };

  if (vendorMismatch) {
    return (
      <StatusBanner tone="error" icon={<X className="size-4" />}>
        <p className="font-semibold">{translate('version-vendor-title')}</p>
        <p className="text-sm">{translate('version-vendor-detail')}</p>
      </StatusBanner>
    );
  }

  if (drift === 'same') {
    return (
      <StatusBanner tone="ok" icon={<Check className="size-4" />}>
        <p className="font-semibold">
          {translate('version-match', { version: versions.source })}
        </p>
      </StatusBanner>
    );
  }

  if (drift === 'patch') {
    return (
      <StatusBanner tone="warning" icon={<TriangleAlert className="size-4" />}>
        <p className="font-semibold">
          {translate('version-patch-title', versions)}
        </p>
        <p className="text-sm">{translate('version-patch-detail')}</p>
        <label className="mt-1 flex items-start gap-2 text-sm">
          <Checkbox
            checked={force}
            onCheckedChange={onForceChange}
            className="mt-0.5"
          />
          {translate('version-patch-acknowledge')}
        </label>
      </StatusBanner>
    );
  }

  return (
    <StatusBanner tone="error" icon={<X className="size-4" />}>
      <p className="font-semibold">
        {translate('version-major-title', versions)}
      </p>
      <p className="text-sm">
        {translate(
          drift === 'unknown'
            ? 'version-unknown-detail'
            : 'version-major-detail',
        )}
      </p>
    </StatusBanner>
  );
};
