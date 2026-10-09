'use client';

import { Check, X } from 'lucide-react';

import { useTranslate } from '@/hooks/useTranslate';
import type { TProbeResult } from '@/models/probe';

import { ProbeRow } from './probeRow';

type TProps = {
  result: TProbeResult;
};

export const ProbeResult = ({ result }: TProps) => {
  const translate = useTranslate();

  if (!result.ok) {
    return (
      <div className="flex items-start gap-2 rounded-base border-2 border-destructive bg-secondary-background p-3 text-sm text-destructive">
        <X className="h-lh w-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-heading">
            {translate(`connect-error-${result.reason}`)}
          </p>
          <p className="text-xs">{translate(`connect-fix-${result.reason}`)}</p>
          <pre className="identifier mt-1 overflow-x-auto text-xs opacity-80">
            {result.detail}
          </pre>
        </div>
      </div>
    );
  }

  const { probe } = result;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-base border-2 bg-secondary-background border-success p-3 text-sm">
      <div className="col-span-2 flex items-center gap-2 font-heading text-success">
        <Check className="size-4" />
        {translate('connect-ok')}
      </div>

      <ProbeRow label={translate('connect-version')}>
        {probe.version ?? '—'}
        {probe.vendor ? ` · ${probe.vendor}` : ''}
      </ProbeRow>
      <ProbeRow label={translate('connect-collections')}>
        {translate('connect-collection-count', {
          count: probe.collectionCount,
        })}
      </ProbeRow>
      <ProbeRow label={translate('connect-role')}>
        {probe.roleName ?? translate('connect-role-unknown')}
        {' · '}
        {translate('connect-admin-ok')}
      </ProbeRow>
    </dl>
  );
};
