'use client';

import { useTranslate } from '@/hooks/useTranslate';
import { hostOf, type TConnection } from '@/models/connection';
import { cn } from '@/utils/cn';

type TProps = {
  connection: TConnection;
};

export const EnvEndpoint = ({ connection }: TProps) => {
  const translate = useTranslate();
  const host = hostOf(connection.url);

  return (
    <span className="flex flex-col leading-tight">
      <span
        className={cn(
          'identifier text-sm font-bold',
          !host && 'font-normal text-muted-foreground/60',
        )}
      >
        {host || translate('env-not-set')}
      </span>
    </span>
  );
};
