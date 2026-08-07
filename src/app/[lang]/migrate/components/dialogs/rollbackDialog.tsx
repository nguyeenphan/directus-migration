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
  target: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const RollbackDialog = ({
  open,
  target,
  onOpenChange,
  onConfirm,
}: TProps) => {
  const translate = useTranslate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {translate('rollback-confirm-title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {translate('rollback-confirm-body', { target })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {translate('rollback-confirm-action')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
