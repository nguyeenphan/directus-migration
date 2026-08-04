import { STEPS } from '@/constants/steps';
import type { TTranslationKey } from '@/utils/translate';

export type TStep = (typeof STEPS)[number];

export type TBlocked = Partial<Record<TStep, TTranslationKey>>;

export type TFlowState = {
  canLeaveConnect: boolean;
  hasPlan: boolean;
  planFor: string;
  fingerprint: string;
  runInProgress: boolean;
  hasDataSelected: boolean;
  sequencesPending: boolean;
  sequencesConfirmed: boolean;
};

export const blockedSteps = (state: TFlowState): TBlocked => {
  if (state.runInProgress) {
    const reason = 'blocked-run-in-progress';
    return { connect: reason, data: reason, apply: reason };
  }

  if (!state.canLeaveConnect) {
    const reason = 'blocked-connect-incomplete';
    return { schema: reason, data: reason, apply: reason };
  }

  if (!state.hasPlan || state.planFor !== state.fingerprint) {
    const reason = 'blocked-plan-stale';
    return { schema: reason, data: reason, apply: reason };
  }

  if (!state.hasDataSelected) return { apply: 'blocked-nothing-selected' };

  if (state.sequencesPending && !state.sequencesConfirmed) {
    return { apply: 'blocked-sequences-unconfirmed' };
  }

  return {};
};
