'use client';

import { CopyButton } from '@/components/copyButton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NOTHING } from '@/constants/changeStyles';
import { useTranslate } from '@/hooks/useTranslate';
import type { TFieldValue } from '@/models/plan';
import { cn } from '@/utils/cn';

type TProps = {
  field: TFieldValue | null;
  onOpenChange: (open: boolean) => void;
};

export const FieldValueDialog = ({ field, onOpenChange }: TProps) => {
  const translate = useTranslate();

  return (
    <AlertDialog open={field !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="data-[size=default]:max-w-[min(82rem,calc(100vw-2rem))] data-[size=default]:sm:max-w-[min(40rem,calc(100vw-2rem))]">
        <AlertDialogHeader>
          <AlertDialogTitle className="identifier">
            {field?.field}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Side
            label={translate('value-target')}
            text={field?.before ?? null}
          />
          <Side
            label={translate('value-source')}
            text={field?.after ?? null}
            isNew={field?.kind === 'modify'}
          />
        </div>

        <AlertDialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 mt-8">
          <AlertDialogCancel>{translate('close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const Side = ({
  label,
  text,
  isNew = false,
}: {
  label: string;
  text: string | null;
  isNew?: boolean;
}) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {text !== null && (
        <CopyButton className="ml-auto" label={label} text={() => text} />
      )}
    </div>
    <pre
      className={cn(
        'identifier max-h-[50vh] overflow-auto whitespace-pre-wrap wrap-break-words border p-2 text-xs',
        text === null && 'text-muted-foreground/50',
        isNew && 'font-medium text-foreground',
      )}
    >
      {text ?? NOTHING}
    </pre>
  </div>
);
