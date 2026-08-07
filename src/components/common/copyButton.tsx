'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslate } from '@/hooks/useTranslate';
import { cn } from '@/utils/cn';

type TProps = {
  text: () => string;
  label: string;
  className?: string;
};

const CONFIRM_MS = 1500;

export const CopyButton = ({ text, label, className }: TProps) => {
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"

      onClick={() => {
        navigator.clipboard?.writeText(text()).then(
          () => setCopied(true),
          () => undefined,
        );
      }}
      aria-label={translate(copied ? 'copy-done' : 'copy-label', { label })}
      title={translate(copied ? 'copy-done' : 'copy-label', { label })}
      className={cn(
        'shrink-0 text-muted-foreground transition-colors hover:text-foreground',
        copied && 'text-success',
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
};
