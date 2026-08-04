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

export const SchemaDriftDialog = ({
  open,
  changeCount,
  onKeepGoing,
  onFixSchema,
}: {
  open: boolean;
  changeCount: number;
  onKeepGoing: () => void;
  onFixSchema: () => void;
}) => {
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

export const RollbackDialog = ({
  open,
  target,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  target: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) => {
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

export const LeaveFlowDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) => {
  const translate = useTranslate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{translate('leave-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {translate('leave-body')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{translate('leave-stay')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {translate('leave-confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
