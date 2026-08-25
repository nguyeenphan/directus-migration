'use client';

import { TriangleAlert } from 'lucide-react';

import { useTranslate } from '@/hooks/useTranslate';
import {
  hasVendorMismatch,
  hasVersionMismatch,
  isIncompatible,
  type TCompatibility,
  unknownMetaKeys,
} from '@/models/plan';

type TProps = {
  compatibility: TCompatibility;
};

export const CompatibilityNotice = ({ compatibility }: TProps) => {
  const translate = useTranslate();

  if (!isIncompatible(compatibility)) return null;

  const unknown = unknownMetaKeys(compatibility);
  const tone = hasVendorMismatch(compatibility) ? 'destructive' : 'warning';

  return (
    <div
      className={`flex items-start gap-2 border p-3 text-sm ${
        tone === 'destructive'
          ? 'border-destructive text-destructive'
          : 'border-warning text-warning'
      }`}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />

      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          {translate('schema-compatibility-title')}
        </p>

        {hasVersionMismatch(compatibility) && (
          <p className="identifier text-xs">
            {translate('schema-compatibility-version', {
              source: compatibility.sourceVersion,
              target: compatibility.targetVersion,
            })}
          </p>
        )}

        {hasVendorMismatch(compatibility) && (
          <p className="identifier text-xs">
            {translate('schema-compatibility-vendor', {
              source: compatibility.sourceVendor,
              target: compatibility.targetVendor,
            })}
          </p>
        )}

        {unknown.length > 0 && (
          <p className="identifier text-xs">
            {translate('schema-compatibility-meta', {
              count: unknown.length,
              keys: unknown.join(', '),
            })}
          </p>
        )}
      </div>
    </div>
  );
};
