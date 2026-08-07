'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslate } from '@/hooks/useTranslate';
import type { TFieldValue } from '@/models/plan';

import { FieldValueSide } from './fieldValueSide';

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
          <FieldValueSide
            label={translate('value-target')}
            text={field?.before ?? null}
          />
          <FieldValueSide
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
