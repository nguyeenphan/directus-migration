'use client';

import {
  Check,
  ListRestart,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { generateSqlScript } from '@/app/[lang]/migrate/operations';
import { CopyButton } from '@/components/common/copyButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { CHANGE_GLYPH, CHANGE_TEXT } from '@/constants/changeStyles';
import { useRecordBrowser } from '@/hooks/useRecordBrowser';
import { useTranslate } from '@/hooks/useTranslate';
import type { TTranslationKey } from '@/lib/i18n/translate';
import type { TConnection } from '@/models/connection';
import {
  isDeleteOnly,
  isEmptyChange,
  missingDependencies,
  pickedKeys,
  sequenceResetsIn,
  type TDataChange,
  type TRecordPicks,
} from '@/models/plan';
import { sequenceResetSql } from '@/models/run';

import { RecompareButton } from '../recompareButton';
import { SqlScriptButton } from '../sqlScriptButton';
import { CollectionList } from './collection/collectionList';
import { RecordDetail } from './record/recordDetail';
import { RecordList } from './record/recordList';

type TProps = {
  source: TConnection;
  target: TConnection;
  rows: TDataChange[];
  selection: Set<string>;
  records: TRecordPicks;
  mirrorData: boolean;
  onSelectionChange: (selection: Set<string>) => void;
  onRecordsChange: (records: TRecordPicks) => void;
  onMirrorDataChange: (mirror: boolean) => void;
  isRecomparing: boolean;
  onRecompare: () => void;
  continueBlocked?: TTranslationKey;
  onContinue: () => void;
};

export const DataStep = ({
  source,
  target,
  rows,
  selection,
  records,
  mirrorData,
  onSelectionChange,
  onRecordsChange,
  onMirrorDataChange,
  isRecomparing,
  onRecompare,
  continueBlocked,
  onContinue,
}: TProps) => {
  const translate = useTranslate();
  const [showSequenceSql, setShowSequenceSql] = useState(false);
  const browser = useRecordBrowser(source, target);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          add: sum.add + row.toCreate,
          modify: sum.modify + (row.toUpdate ?? 0),
          delete: sum.delete + row.extraInTarget,
        }),
        { add: 0, modify: 0, delete: 0 },
      ),
    [rows],
  );

  const sequenceSql = useMemo(
    () => sequenceResetSql(sequenceResetsIn(rows, selection)),
    [rows, selection],
  );

  const dependencies = useMemo(
    () => missingDependencies(rows, selection),
    [rows, selection],
  );

  const toggle = (collections: string[], isSelected: boolean) => {
    const next = new Set(selection);

    for (const collection of collections) {
      if (isSelected) next.add(collection);
      else next.delete(collection);
    }

    onSelectionChange(next);
  };

  const pickRecords = (keys: string[], isPicked: boolean) => {
    const collection = browser.active;
    if (!collection) return;

    const all = browser.records.map((record) => record.key);
    const current = records[collection] ?? all;
    const picked = isPicked
      ? all.filter((key) => current.includes(key) || keys.includes(key))
      : current.filter((key) => !keys.includes(key));

    const next = { ...records, [collection]: picked };
    if (picked.length === all.length) delete next[collection];

    onRecordsChange(next);

    if (isPicked && !selection.has(collection)) toggle([collection], true);
  };

  const setMirror = (mirror: boolean) => {
    onMirrorDataChange(mirror);

    const next = new Set(selection);

    for (const row of rows.filter(isDeleteOnly)) {
      if (mirror) next.add(row.collection);
      else next.delete(row.collection);
    }

    onSelectionChange(next);
  };

  if (rows.every(isEmptyChange)) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
        <div className="grid flex-1 place-items-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Check className="size-8 text-success" strokeWidth={1.5} />
            <p className="text-xl font-heading tracking-tight">
              {translate('data-in-sync-title')}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {translate('data-in-sync-detail', { count: rows.length })}
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-end border-t pt-3">
          <RecompareButton
            isRecomparing={isRecomparing}
            onRecompare={onRecompare}
          />
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ResizablePanelGroup className="min-h-0 flex-1 gap-2">
        <ResizablePanel defaultSize={24} minSize={16}>
          <CollectionList
            rows={rows}
            selection={selection}
            mirrorData={mirrorData}
            active={browser.active}
            onToggle={toggle}
            onInspect={browser.inspect}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={18}>
          {!browser.active && (
            <div className="flex h-full items-center justify-center rounded-base border-2 bg-secondary-background p-6 text-sm text-muted-foreground">
              {translate('data-pick-a-collection')}
            </div>
          )}
          {browser.detail?.phase === 'loading' && (
            <div className="flex h-full items-center justify-center gap-2 rounded-base border-2 bg-secondary-background p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {translate('data-loading')}
            </div>
          )}
          {browser.detail?.phase === 'error' && (
            <div className="h-full rounded-base border-2 border-destructive bg-secondary-background p-3">
              <div className="flex items-start gap-2">
                <p className="font-heading text-destructive">
                  {translate('data-load-failed')}
                </p>
                <button
                  type="button"
                  onClick={browser.reload}
                  title={translate('plan-retry')}
                  className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="size-4" />
                  <span className="sr-only">{translate('plan-retry')}</span>
                </button>
              </div>
              <pre className="identifier mt-1 overflow-x-auto text-xs">
                {browser.detail.error}
              </pre>
            </div>
          )}
          {browser.detail?.phase === 'loaded' && (
            <RecordList
              records={browser.records}
              activeKey={browser.activeKey}
              picked={pickedKeys(records, browser.active ?? '')}
              onSelect={browser.select}
              onPick={pickRecords}
            />
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={46} minSize={28}>
          <RecordDetail
            record={browser.record}
            position={{ index: browser.index, total: browser.records.length }}
            onNavigate={browser.step}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {dependencies.length > 0 && (
        <section className="rounded-base border-2 bg-secondary-background border-warning">
          <div className="flex items-center gap-2 border-b px-3 py-1.5">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <p className="text-sm font-heading text-warning">
              {translate('data-dependency-title', {
                count: dependencies.length,
              })}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() =>
                toggle(
                  dependencies.flatMap((entry) => entry.missing),
                  true,
                )
              }
            >
              {translate('data-dependency-fix')}
            </Button>
          </div>

          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {translate('data-dependency-detail')}
            </p>
            <ul className="diff-dense mt-1 max-h-32 overflow-y-auto">
              {dependencies.map((entry) => (
                <li key={entry.collection} className="identifier text-xs">
                  {translate('data-dependency-line', {
                    collection: entry.collection,
                    missing: entry.missing.join(', '),
                  })}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {totals.delete > 0 && (
        <section className="rounded-base border-2 bg-secondary-background border-destructive px-3 py-2">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={mirrorData}
              onCheckedChange={setMirror}
              className="mt-0.5"
            />
            <span>
              <span className="font-heading text-destructive">
                {translate('data-mirror-title', { count: totals.delete })}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {translate('data-mirror-detail')}
              </span>
            </span>
          </label>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-4 border-t pt-3 text-sm">
        <span className="identifier flex gap-3 tabular-nums">
          {(['add', 'modify', 'delete'] as const).map((kind) => (
            <span key={kind} className={CHANGE_TEXT[kind]}>
              {CHANGE_GLYPH[kind]}
              {totals[kind]}
            </span>
          ))}
        </span>

        <span className="text-muted-foreground">
          {translate('data-selected', { count: selection.size })}
        </span>

        <span className="ml-auto flex items-center gap-2">
          {sequenceSql && (
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => setShowSequenceSql(true)}
            >
              <ListRestart className="size-4" />
              {translate('data-sequence-button')}
            </Button>
          )}
          <SqlScriptButton
            disabled={selection.size === 0}
            generate={(onLog) =>
              generateSqlScript(
                source,
                target,
                rows,
                [...selection],
                mirrorData,
                records,
                onLog,
              )
            }
          />
          <RecompareButton
            isRecomparing={isRecomparing}
            onRecompare={onRecompare}
          />
        </span>

        <Button
          size="lg"
          onClick={onContinue}
          disabled={Boolean(continueBlocked)}
          title={continueBlocked ? translate(continueBlocked) : undefined}
        >
          {translate('data-continue')}
        </Button>
      </footer>

      <Dialog open={showSequenceSql} onOpenChange={setShowSequenceSql}>
        <DialogContent className="w-[95vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>{translate('data-sequence-title')}</DialogTitle>
            <DialogDescription>
              {translate('data-sequence-detail')}
            </DialogDescription>
          </DialogHeader>

          <div className="relative min-h-0 flex-1">
            <div className="absolute top-2 right-2">
              <CopyButton
                label={translate('data-sequence-title')}
                text={() => sequenceSql}
              />
            </div>
            <pre className="identifier h-full overflow-auto bg-muted p-3 pr-12 text-xs whitespace-pre">
              {sequenceSql}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
