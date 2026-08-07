'use client';

import Image from 'next/image';

import { NOTHING } from '@/constants/changeStyles';
import { assetThumbnailUrl, type TConnection } from '@/models/connection';
import { cn } from '@/utils/cn';

type TProps = {
  connection: TConnection;
  id: string | null;
  label: string | null;
  isNew?: boolean;
};

export const AssetThumbnail = ({
  connection,
  id,
  label,
  isNew = false,
}: TProps) => (
  <span className="flex min-w-0 items-center gap-2">
    {id ? (
      <Image
        // ponytail: unoptimized — connection host is user-supplied at runtime,
        // next/image remotePatterns can only be configured statically.
        unoptimized
        src={assetThumbnailUrl(connection, id)}
        alt=""
        width={40}
        height={40}
        referrerPolicy="no-referrer"
        className="size-10 shrink-0 border object-cover"
      />
    ) : (
      <span className="flex size-10 shrink-0 items-center justify-center border text-muted-foreground/50">
        {NOTHING}
      </span>
    )}
    <span
      className={cn(
        'identifier truncate text-xs',
        isNew ? 'text-foreground' : 'text-muted-foreground',
      )}
      title={label ?? undefined}
    >
      {label ?? NOTHING}
    </span>
  </span>
);
