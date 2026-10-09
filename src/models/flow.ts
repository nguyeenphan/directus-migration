import { STEPS } from '@/constants/steps';
import type { TTranslationKey } from '@/lib/i18n/translate';

export type TStep = (typeof STEPS)[number];

export type TBlocked = Partial<Record<TStep, TTranslationKey>>;

export type TFlowState = {
  canLeaveConnect: boolean;
  hasPlan: boolean;
  planFor: string;
  fingerprint: string;

  // The step a run is pinned to while it is still going, if any.
  runOn: TStep | null;
  hasDataSelected: boolean;
  dependenciesMissing: boolean;
};

export const blockedSteps = (state: TFlowState): TBlocked => {
  if (state.runOn) {
    const reason = 'blocked-run-in-progress';

    return Object.fromEntries(
      STEPS.filter((step) => step !== state.runOn).map((step) => [
        step,
        reason,
      ]),
    );
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

  if (state.dependenciesMissing) {
    return { apply: 'blocked-missing-dependencies' };
  }

  return {};
};
