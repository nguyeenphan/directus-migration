'use client';

import type { TConnection } from '@/models/connection';
import type { TFieldValue } from '@/models/plan';

import { WordDiffView } from '../diff/wordDiffView';
import { AssetThumbnail } from './assetThumbnail';
import { PlainValue } from './plainValue';

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
        <AssetThumbnail
          connection={target}
          id={field.beforeRef}
          label={field.before}
        />
        <AssetThumbnail
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
      <PlainValue text={field.before} />
      <PlainValue text={field.after} isNew={field.kind === 'modify'} />
    </div>
  );
};
