'use client';

import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/useTranslate';

type TProps = {
  position: { index: number; total: number };
  onNavigate: (delta: number) => void;
};

export const RecordNav = ({ position, onNavigate }: TProps) => {
  const translate = useTranslate();

  return (
    <footer className="flex items-center justify-center gap-4 border-t px-4 py-2 text-sm">
      <Button
        variant="ghost"
        size="sm"
        disabled={position.index <= 0}
        onClick={() => onNavigate(-1)}
      >
        ‹ {translate('data-previous')}
      </Button>
      <span className="identifier tabular-nums text-muted-foreground">
        {position.index + 1} / {position.total}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={position.index >= position.total - 1}
        onClick={() => onNavigate(1)}
      >
        {translate('data-next')} ›
      </Button>
    </footer>
  );
};
