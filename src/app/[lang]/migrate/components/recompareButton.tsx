'use client';

import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/useTranslate';

export const RecompareButton = ({
  isRecomparing,
  onRecompare,
}: {
  isRecomparing: boolean;
  onRecompare: () => void;
}) => {
  const translate = useTranslate();

  return (
    <Button
      variant="outline"
      size="lg"
      className="gap-2"
      disabled={isRecomparing}
      onClick={onRecompare}
    >
      {isRecomparing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {translate('recompare')}
    </Button>
  );
};
