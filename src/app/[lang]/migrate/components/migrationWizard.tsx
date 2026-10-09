'use client';

import { useEffect, useState } from 'react';

import { EnvBar } from '@/components/layout/envBar';
import { useApplyRun } from '@/hooks/useApplyRun';
import { useConnections } from '@/hooks/useConnections';
import { useMigrationSelections } from '@/hooks/useMigrationSelections';
import { usePlan } from '@/hooks/usePlan';
import { useSchemaRun } from '@/hooks/useSchemaRun';
import { useTranslate } from '@/hooks/useTranslate';
import { blockedSteps, type TStep } from '@/models/flow';
import { missingDependencies } from '@/models/plan';
import { isFinished } from '@/models/run';

import { ApplyStep } from './apply/applyStep';
import { ConfirmWriteDialog } from './apply/step/confirmWriteDialog';
import { PlanLogDialog } from './connect/connection/planLogDialog';
import { ConnectStep } from './connect/connectStep';
import { DataStep } from './data/dataStep';
import { LeaveFlowDialog } from './dialogs/leaveFlowDialog';
import { SchemaDriftDialog } from './dialogs/schemaDriftDialog';
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
      applyRun.clear();
      setStep(openAt);
    },
  });

  const schemaRun = useSchemaRun({
    source: ends.source,
    target: ends.target,
    collections: picked.schema,
    force: ends.force,
  });

  const applyRun = useApplyRun({
    source: ends.source,
    target: ends.target,
    collections: picked.data,
    excluded: picked.excluded,
    force: ends.force,
    mirrorData: picked.mirrorData,
  });

  const plan = comparison.plan;

  const isRunning = (run: typeof applyRun.run) =>
    run !== null && !isFinished(run);

  const blocked = blockedSteps({
    canLeaveConnect: ends.canLeaveConnect,
    hasPlan: plan !== null,
    planFor: comparison.builtFor,
    fingerprint: ends.fingerprint,
    runOn: isRunning(schemaRun.run)
      ? 'schema'
      : isRunning(applyRun.run)
        ? 'apply'
        : null,
    hasDataSelected: picked.data.size > 0,
    dependenciesMissing: Boolean(
      plan && missingDependencies(plan.data, picked.data).length > 0,
    ),
  });

  const resetFlow = () => {
    comparison.reset();
    schemaRun.clear();
    applyRun.clear();
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
            key={plan.generatedAt}
            source={ends.source}
            target={ends.target}
            force={ends.force}
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
            key={plan.generatedAt}
            source={ends.source}
            target={ends.target}
            rows={plan.data}
            selection={picked.data}
            excluded={picked.excluded}
            mirrorData={picked.mirrorData}
            onSelectionChange={picked.setData}
            onExcludedChange={picked.setExcluded}
            onMirrorDataChange={picked.setMirrorData}
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
            excluded={picked.excluded}
            mirrorData={picked.mirrorData}
            applyRun={applyRun}
            isRecomparing={comparison.isBuilding}
            onRecompare={() => comparison.build('data')}
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
