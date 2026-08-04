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
  host: string;
  recordCount: number;
  deleteCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const ConfirmWriteDialog = ({
  open,
  host,
  recordCount,
  deleteCount,
  onOpenChange,
  onConfirm,
}: TProps) => {
  const translate = useTranslate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {translate('apply-confirm-title', { target: host })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {translate('apply-confirm-body', {
              records: recordCount,
              deletes: deleteCount,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {translate('apply-confirm-action')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
