'use client';

import { Check, X } from 'lucide-react';

import { useTranslate } from '@/hooks/useTranslate';
import type { TProbeResult } from '@/models/probe';

type TProps = {
  result: TProbeResult;
};

export const ProbeResult = ({ result }: TProps) => {
  const translate = useTranslate();

  if (!result.ok) {
    return (
      <div className="flex items-start gap-2 border-2 border-destructive p-3 text-sm text-destructive">
        <X className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">
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
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border border-success p-3 text-sm">
      <div className="col-span-2 flex items-center gap-2 font-semibold text-success">
        <Check className="size-4" />
        {translate('connect-ok')}
      </div>

      <Row label={translate('connect-version')}>
        {probe.version ?? '—'}
        {probe.vendor ? ` · ${probe.vendor}` : ''}
      </Row>
      <Row label={translate('connect-collections')}>
        {translate('connect-collection-count', {
          count: probe.collectionCount,
        })}
      </Row>
      <Row label={translate('connect-role')}>
        {probe.roleName ?? translate('connect-role-unknown')}
        {' · '}
        {translate('connect-admin-ok')}
      </Row>
    </dl>
  );
};

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="identifier">{children}</dd>
  </>
);
