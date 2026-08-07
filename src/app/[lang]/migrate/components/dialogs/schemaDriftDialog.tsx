'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslate } from '@/hooks/useTranslate';

type TProps = {
  open: boolean;
  changeCount: number;
  onKeepGoing: () => void;
  onFixSchema: () => void;
};

export const SchemaDriftDialog = ({
  open,
  changeCount,
  onKeepGoing,
  onFixSchema,
}: TProps) => {
  const translate = useTranslate();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{translate('drift-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {translate('drift-body', { changes: changeCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepGoing}>
            {translate('drift-continue-data')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onFixSchema}>
            {translate('drift-back-to-schema')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
