'use client';

import { Check, TriangleAlert, X } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { useTranslate } from '@/hooks/useTranslate';
import type { TVersionDrift } from '@/utils/version';

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
      <Banner tone="error" icon={<X className="size-4" />}>
        <p className="font-semibold">{translate('version-vendor-title')}</p>
        <p className="text-sm">{translate('version-vendor-detail')}</p>
      </Banner>
    );
  }

  if (drift === 'same') {
    return (
      <Banner tone="ok" icon={<Check className="size-4" />}>
        <p className="font-semibold">
          {translate('version-match', { version: versions.source })}
        </p>
      </Banner>
    );
  }

  if (drift === 'patch') {
    return (
      <Banner tone="warning" icon={<TriangleAlert className="size-4" />}>
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
      </Banner>
    );
  }

  return (
    <Banner tone="error" icon={<X className="size-4" />}>
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
    </Banner>
  );
};

const TONE = {
  ok: 'border-success text-success',
  warning: 'border-warning text-warning',
  error: 'border-2 border-destructive text-destructive',
} as const;

const Banner = ({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className={`flex items-start gap-2 border p-3 ${TONE[tone]}`}>
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);
