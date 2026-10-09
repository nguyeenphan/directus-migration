'use client';

import { Check, FileCode2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { CopyButton } from '@/components/common/copyButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type TSqlGenerator, useSqlScript } from '@/hooks/useSqlScript';
import { useTranslate } from '@/hooks/useTranslate';

type TProps = {
  generate: TSqlGenerator;
  disabled?: boolean;
};

export const SqlScriptButton = ({ generate, disabled }: TProps) => {
  const translate = useTranslate();
  const script = useSqlScript();
  const [open, setOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [script.log]);

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="gap-2"
        disabled={disabled || script.phase === 'loading'}
        onClick={() => {
          setOpen(true);
          void script.generate(generate);
        }}
      >
        {script.phase === 'loading' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : script.phase === 'ready' ? (
          <Check className="size-4 text-success" />
        ) : (
          <FileCode2 className="size-4" />
        )}
        {translate(
          script.phase === 'ready' ? 'data-sql-generated' : 'data-generate-sql',
        )}
      </Button>

      {script.phase === 'ready' && (
        <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
          {translate('data-view-sql')}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {script.phase === 'loading' && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {translate(
                script.phase === 'ready'
                  ? 'data-sql-script-title'
                  : 'data-sql-building',
              )}
            </DialogTitle>
          </DialogHeader>

          {script.phase === 'ready' ? (
            <div className="relative min-h-0 flex-1">
              <div className="absolute top-2 right-2">
                <CopyButton
                  label={translate('data-sql-script-title')}
                  text={() => script.sql}
                />
              </div>
              <pre className="identifier h-full overflow-auto bg-muted p-3 pr-12 text-xs whitespace-pre">
                {script.sql}
              </pre>
            </div>
          ) : (
            <div className="max-h-80 min-h-0 flex-1 overflow-y-auto rounded-base border-2 p-3">
              <pre className="identifier text-xs wrap-break-word whitespace-pre-wrap">
                {script.log.join('\n')}
              </pre>
              {script.phase === 'error' && (
                <pre className="identifier mt-2 text-xs wrap-break-word whitespace-pre-wrap text-destructive">
                  {script.error}
                </pre>
              )}
              <div ref={bottom} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
