'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/useTranslate';

type TProps = {
  open: boolean;
  lines: string[];
  isPlanning: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
};

export const PlanLogDialog = ({
  open,
  lines,
  isPlanning,
  error,
  onClose,
  onRetry,
}: TProps) => {
  const translate = useTranslate();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="data-[size=default]:max-w-[min(64rem,calc(100vw-2rem))] data-[size=default]:sm:max-w-[min(64rem,calc(100vw-2rem))]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isPlanning && <Loader2 className="size-4 animate-spin" />}
            {translate(isPlanning ? 'plan-building' : 'plan-log-title')}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="max-h-80 overflow-y-auto border-2 p-3">
          <pre className="identifier text-xs wrap-break-word whitespace-pre-wrap">
            {lines.join('\n')}
          </pre>
          {error && (
            <pre className="identifier mt-2 text-xs wrap-break-word whitespace-pre-wrap text-destructive">
              {error}
            </pre>
          )}
          <div ref={bottom} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPlanning}>
            {translate('close')}
          </AlertDialogCancel>

          {error && (
            <Button disabled={isPlanning} onClick={onRetry} className="gap-2">
              <RotateCcw className="size-4" />
              {translate('plan-retry')}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
