'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { ConfirmWriteDialog } from '../migrate/components/apply/step/confirmWriteDialog';

export const ConfirmWriteDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Apply to target.test</Button>
      <ConfirmWriteDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
};
