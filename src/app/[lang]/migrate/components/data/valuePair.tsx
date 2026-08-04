'use client';

import { NOTHING } from '@/constants/changeStyles';
import { assetThumbnailUrl, type TConnection } from '@/models/connection';
import type { TFieldValue } from '@/models/plan';
import { cn } from '@/utils/cn';

import { WordDiffView } from './wordDiffView';

type TProps = {
  field: TFieldValue;
  source: TConnection;
  target: TConnection;
};

export const ValuePair = ({ field, source, target }: TProps) => {
  if (field.display === 'longtext' && field.kind === 'modify') {
    return (
      <WordDiffView before={field.before ?? ''} after={field.after ?? ''} />
    );
  }

  if (field.display === 'file') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Thumbnail
          connection={target}
          id={field.beforeRef}
          label={field.before}
        />
        <Thumbnail
          connection={source}
          id={field.afterRef}
          label={field.after}
          isNew
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Value text={field.before} />
      <Value text={field.after} isNew={field.kind === 'modify'} />
    </div>
  );
};

const Value = ({
  text,
  isNew = false,
}: {
  text: string | null;
  isNew?: boolean;
}) => (
  <span
    className={cn(
      'identifier break-words',

      text === null && 'text-muted-foreground/50',
      isNew && 'font-medium text-foreground',
    )}
  >
    {text ?? NOTHING}
  </span>
);

const Thumbnail = ({
  connection,
  id,
  label,
  isNew = false,
}: {
  connection: TConnection;
  id: string | null;
  label: string | null;
  isNew?: boolean;
}) => (
  <span className="flex min-w-0 items-center gap-2">
    {id ? (
      <img
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
