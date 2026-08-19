'use client';

import { Check, FileCode2, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { CopyButton } from '@/components/common/copyButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSqlScript } from '@/hooks/useSqlScript';
import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection } from '@/models/connection';
import type { TDataChange } from '@/models/plan';

type TProps = {
  source: TConnection;
  target: TConnection;
  rows: TDataChange[];
  selection: Set<string>;
  mirrorData: boolean;
};

export const SqlScriptButton = ({
  source,
  target,
  rows,
  selection,
  mirrorData,
}: TProps) => {
  const translate = useTranslate();
  const script = useSqlScript(source, target);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="gap-2"
        disabled={script.phase === 'loading' || selection.size === 0}
        onClick={async () => {
          const ok = await script.generate(rows, selection, mirrorData);
          if (ok) setOpen(true);
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

      {script.phase === 'error' && (
        <span className="text-sm text-destructive">{script.error}</span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw]">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle>{translate('data-sql-script-title')}</DialogTitle>
            {script.phase === 'ready' && (
              <CopyButton label={translate('data-sql-script-title')} text={() => script.sql} />
            )}
          </DialogHeader>
          <pre className="identifier min-h-0 flex-1 overflow-auto bg-muted p-3 text-xs whitespace-pre">
            {script.sql}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
};
