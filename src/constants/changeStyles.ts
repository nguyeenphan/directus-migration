import {
  Ban,
  CircleAlert,
  Equal,
  type LucideIcon,
  Minus,
  Pencil,
  Plus,
} from 'lucide-react';

import type { TChangeKind } from '@/models/plan';

/**
 * One lucide icon per change kind, so marks share the stroke of every other
 * icon on screen. Log lines keep their plain `+N ~N -N` text.
 */
export const CHANGE_ICON: Record<TChangeKind, LucideIcon> = {
  add: Plus,
  modify: Pencil,
  delete: Minus,
  unchanged: Equal,
  conflict: CircleAlert,
  blocked: Ban,
};

export const CHANGE_TEXT: Record<TChangeKind, string> = {
  add: 'text-success',
  modify: 'text-warning',
  delete: 'text-destructive',
  unchanged: 'text-muted-foreground',
  conflict: 'text-destructive',
  blocked: 'text-muted-foreground',
};

export const CHANGE_ROW: Record<TChangeKind, string> = {
  add: 'bg-success-muted',
  modify: 'bg-warning-muted',
  delete: 'bg-destructive-muted',
  unchanged: '',
  conflict: '',
  blocked: 'opacity-60',
};

export const CHANGE_BORDER: Record<TChangeKind, string> = {
  add: 'border-success',
  modify: 'border-warning',
  delete: 'border-destructive',
  unchanged: 'border-border',
  conflict: 'border-destructive',
  blocked: 'border-border',
};

export const DIFF_VALUE: Record<'before' | 'after', string> = {
  before: 'bg-diff-del',
  after: 'bg-diff-add',
};

export const NOTHING = '·';
