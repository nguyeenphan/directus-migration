'use client';

import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';

import { CopyButton } from '@/components/common/copyButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { CHANGE_GLYPH, CHANGE_TEXT } from '@/constants/changeStyles';
import { useRecordBrowser } from '@/hooks/useRecordBrowser';
import { useTranslate } from '@/hooks/useTranslate';
import type { TConnection } from '@/models/connection';
import {
  isDeleteOnly,
  isEmptyChange,
  sequenceResetsIn,
  type TDataChange,
} from '@/models/plan';
import { sequenceResetSql } from '@/models/run';
import type { TTranslationKey } from '@/utils/translate';

import { RecompareButton } from '../recompareButton';
import { CollectionList } from './collection/collectionList';
import { RecordDetail } from './record/recordDetail';
import { RecordList } from './record/recordList';

type TProps = {
  source: TConnection;
  target: TConnection;
  rows: TDataChange[];
  selection: Set<string>;
  mirrorData: boolean;
  confirmedSql: string;
  onSelectionChange: (selection: Set<string>) => void;
  onMirrorDataChange: (mirror: boolean) => void;
  onConfirmedSqlChange: (sql: string) => void;
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
  mirrorData,
  confirmedSql,
  onSelectionChange,
  onMirrorDataChange,
  onConfirmedSqlChange,
  isRecomparing,
  onRecompare,
  continueBlocked,
  onContinue,
}: TProps) => {
  const translate = useTranslate();
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

  const sequencesDone = confirmedSql === sequenceSql;

  const toggle = (collections: string[], isSelected: boolean) => {
    const next = new Set(selection);

    for (const collection of collections) {
      if (isSelected) next.add(collection);
      else next.delete(collection);
    }

    onSelectionChange(next);
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
            <p className="text-xl font-semibold tracking-tight">
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
            <div className="flex h-full items-center justify-center border p-6 text-sm text-muted-foreground">
              {translate('data-pick-a-collection')}
            </div>
          )}
          {browser.detail?.phase === 'loading' && (
            <div className="flex h-full items-center justify-center gap-2 border p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {translate('data-loading')}
            </div>
          )}
          {browser.detail?.phase === 'error' && (
            <div className="h-full border-2 border-destructive p-3">
              <p className="font-semibold text-destructive">
                {translate('data-load-failed')}
              </p>
              <pre className="identifier mt-1 overflow-x-auto text-xs">
                {browser.detail.error}
              </pre>
            </div>
          )}
          {browser.detail?.phase === 'loaded' && (
            <RecordList
              records={browser.records}
              activeKey={browser.activeKey}
              onSelect={browser.select}
            />
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={46} minSize={28}>
          <RecordDetail
            record={browser.record}
            position={{ index: browser.index, total: browser.records.length }}
            source={source}
            target={target}
            onNavigate={browser.step}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {sequenceSql && (
        <section className="border border-warning">
          <div className="flex items-center gap-2 border-b px-3 py-1.5">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <p className="text-sm font-semibold text-warning">
              {translate('data-sequence-title')}
            </p>
            <CopyButton
              className="ml-auto"
              label={translate('data-sequence-title')}
              text={() => sequenceSql}
            />
          </div>

          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {translate('data-sequence-detail')}
            </p>
            <pre className="identifier mt-2 max-h-40 overflow-auto bg-muted p-2 text-xs">
              {sequenceSql}
            </pre>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <Checkbox
                checked={sequencesDone}
                onCheckedChange={(checked) =>
                  onConfirmedSqlChange(checked ? sequenceSql : '')
                }
                className="mt-0.5"
              />
              {translate('data-sequence-confirm')}
            </label>
          </div>
        </section>
      )}

      {totals.delete > 0 && (
        <section className="border border-destructive px-3 py-2">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={mirrorData}
              onCheckedChange={setMirror}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-destructive">
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

        <span className="ml-auto">
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
    </div>
  );
};
