'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslate } from '@/hooks/useTranslate';
import { isFilledIn, type TConnection } from '@/models/connection';
import type { TProbeResult } from '@/models/probe';

import { testConnection } from '../../../operations';
import { ProbeResult } from '../probe/probeResult';

type TProps = {
  caption: string;
  connection: TConnection;
  probe: TProbeResult | null;
  onChange: (connection: TConnection) => void;
  onProbe: (result: TProbeResult | null) => void;
};

export const ConnectionCard = ({
  caption,
  connection,
  probe,
  onChange,
  onProbe,
}: TProps) => {
  const translate = useTranslate();
  const [showToken, setShowToken] = useState(false);
  const [isTesting, startTesting] = useTransition();

  const update = (patch: Partial<TConnection>) => {
    onChange({ ...connection, ...patch });
    onProbe(null);
  };

  const test = () =>
    startTesting(async () => onProbe(await testConnection(connection)));

  return (
    <section className="flex flex-col gap-4 border p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {caption}
      </h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${caption}-url`}>{translate('connect-url')}</Label>
        <Input
          id={`${caption}-url`}
          value={connection.url}
          onChange={(event) => update({ url: event.target.value })}
          placeholder="https://cms.example.com"
          autoComplete="off"
          spellCheck={false}
          className="identifier"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${caption}-token`}>{translate('connect-token')}</Label>
        <div className="flex gap-1">
          <Input
            id={`${caption}-token`}
            value={connection.token}
            onChange={(event) => update({ token: event.target.value })}
            type={showToken ? 'text' : 'password'}

            autoComplete="off"
            spellCheck={false}
            className="identifier"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={translate(
              showToken ? 'connect-hide-token' : 'connect-show-token',
            )}
            onClick={() => setShowToken((current) => !current)}
          >
            {showToken ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        disabled={!isFilledIn(connection) || isTesting}
        onClick={test}
        className="gap-2 self-start"
      >
        {isTesting && <Loader2 className="size-4 animate-spin" />}
        {translate('connect-test')}
      </Button>

      {probe && <ProbeResult result={probe} />}
    </section>
  );
};
