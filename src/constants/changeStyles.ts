import type { TChangeKind } from '@/models/plan';

export const CHANGE_GLYPH: Record<TChangeKind, string> = {
  add: '+',
  modify: '~',
  delete: '−',
  unchanged: '=',
  conflict: '!',
  blocked: '⊘',
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
