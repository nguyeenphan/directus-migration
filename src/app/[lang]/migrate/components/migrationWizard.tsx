'use client';

import { useEffect, useState } from 'react';

import { EnvBar } from '@/components/envBar';
import { useConnections } from '@/hooks/useConnections';
import { useMigrationSelections } from '@/hooks/useMigrationSelections';
import { usePlan } from '@/hooks/usePlan';
import { useSchemaRun } from '@/hooks/useSchemaRun';
import { useTranslate } from '@/hooks/useTranslate';
import { hostOf } from '@/models/connection';
import { blockedSteps, type TStep } from '@/models/flow';
import { destructiveChanges, sequenceResetsIn } from '@/models/plan';
import { isFinished, sequenceResetSql } from '@/models/run';

import { ApplyStep } from './apply/applyStep';
import { ConfirmWriteDialog } from './apply/confirmWriteDialog';
import { ConnectStep } from './connect/connectStep';
import { PlanLogDialog } from './connect/planLogDialog';
import { DataStep } from './data/dataStep';
import { LeaveFlowDialog, SchemaDriftDialog } from './flowDialogs';
import { SchemaRunView } from './schema/schemaRunView';
import { SchemaStep } from './schema/schemaStep';

export const MigrationWizard = () => {
  const translate = useTranslate();

  const [step, setStep] = useState<TStep>('connect');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const ends = useConnections();
  const picked = useMigrationSelections();

  const comparison = usePlan({
    source: ends.source,
    target: ends.target,
    force: ends.force,
    fingerprint: ends.fingerprint,
    onAdopted: (adopted, openAt) => {
      picked.resetFor(adopted);
      setStep(openAt);
    },
  });

  const schemaRun = useSchemaRun({
    source: ends.source,
    target: ends.target,
    collections: picked.schema,
    force: ends.force,
  });

  const plan = comparison.plan;

  const blocked = blockedSteps({
    canLeaveConnect: ends.canLeaveConnect,
    hasPlan: plan !== null,
    planFor: comparison.builtFor,
    fingerprint: ends.fingerprint,
    runInProgress: schemaRun.run !== null && !isFinished(schemaRun.run),
    hasDataSelected: picked.data.size > 0,
    sequencesPending: Boolean(
      plan && sequenceResetSql(sequenceResetsIn(plan.data, picked.data)),
    ),
    sequencesConfirmed: Boolean(picked.confirmedSql),
  });

  const resetFlow = () => {
    comparison.reset();
    schemaRun.clear();
    picked.setConfirmedSql('');
    setStep('connect');
  };

  const goTo = (next: TStep) => {
    if (blocked[next]) return;

    if (next === 'connect' && step !== 'connect') return setConfirmLeave(true);

    setStep(next);
  };

  useEffect(() => {
    if (step === 'connect') return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [step]);

  return (
    <>
      <EnvBar
        source={ends.source}
        target={ends.target}
        step={step}
        blocked={blocked}
        onNavigate={goTo}
      >
        {plan && (
          <span className="identifier text-xs text-muted-foreground">
            {translate('plan-generated-at', {
              time: new Date(plan.generatedAt).toLocaleTimeString(),
            })}
          </span>
        )}
      </EnvBar>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-6 py-4">
        {step === 'connect' && (
          <ConnectStep
            source={ends.source}
            target={ends.target}
            probes={ends.probes}
            drift={ends.drift}
            vendorMismatch={ends.vendorMismatch}
            force={ends.force}
            canContinue={ends.canLeaveConnect}
            isPlanning={comparison.isBuilding}
            planError={comparison.error}
            onChange={ends.change}
            onProbe={ends.probed}
            onForceChange={ends.setForce}
            onSwap={() => {
              ends.swap();
              resetFlow();
            }}
            onContinue={() => comparison.build('schema')}
          />
        )}

        {step === 'schema' && schemaRun.run && (
          <SchemaRunView
            run={schemaRun.run}
            isPlanning={comparison.isBuilding}
            onRunChange={schemaRun.setRun}
            onRetry={schemaRun.applyNow}
            onBack={schemaRun.clear}
            onContinue={() => {
              schemaRun.clear();
              comparison.build('data');
            }}
          />
        )}

        {step === 'schema' && !schemaRun.run && plan && (
          <SchemaStep
            plan={plan.schema}
            selection={picked.schema}
            applySchema={picked.applySchema}
            isApplyingSchema={schemaRun.isStarting}
            schemaRunError={schemaRun.error}
            onApplySchemaChange={picked.setApplySchema}
            onSelectionChange={picked.setSchema}
            onApplySchemaNow={schemaRun.applyNow}
            isRecomparing={comparison.isBuilding}
            onRecompare={() => comparison.build('schema')}
            onContinue={() => goTo('data')}
          />
        )}

        {step === 'data' && plan && (
          <DataStep
            source={ends.source}
            target={ends.target}
            rows={plan.data}
            selection={picked.data}
            confirmedSql={picked.confirmedSql}
            onSelectionChange={picked.setData}
            onConfirmedSqlChange={picked.setConfirmedSql}
            isRecomparing={comparison.isBuilding}
            onRecompare={() => comparison.build('data')}
            continueBlocked={blocked.apply}
            onContinue={() => goTo('apply')}
          />
        )}

        {step === 'apply' && plan && (
          <ApplyStep
            source={ends.source}
            target={ends.target}
            plan={plan}
            dataSelection={picked.data}
            sequencesConfirmed={Boolean(picked.confirmedSql)}
            force={ends.force}
            onBack={() => goTo('data')}
          />
        )}

        <PlanLogDialog
          open={comparison.showLog}
          lines={comparison.log}
          isPlanning={comparison.isBuilding}
          error={comparison.error}
          onClose={comparison.closeLog}
          onRetry={() => comparison.build(comparison.openTarget)}
        />

        <ConfirmWriteDialog
          open={schemaRun.needsConfirmation}
          host={hostOf(ends.target.url)}
          recordCount={0}
          deleteCount={plan ? destructiveChanges(plan.schema).length : 0}
          onOpenChange={schemaRun.setNeedsConfirmation}
          onConfirm={schemaRun.start}
        />

        <SchemaDriftDialog
          open={comparison.drift !== null}
          changeCount={comparison.drift?.plan.schema.collections.length ?? 0}
          onKeepGoing={() => comparison.resolveDrift('data')}
          onFixSchema={() => comparison.resolveDrift('schema')}
        />

        <LeaveFlowDialog
          open={confirmLeave}
          onOpenChange={setConfirmLeave}
          onConfirm={() => {
            setConfirmLeave(false);
            resetFlow();
          }}
        />
      </main>
    </>
  );
};
