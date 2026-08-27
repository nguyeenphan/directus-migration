import type { SchemaSnapshotOutput } from '@directus/sdk';
import { schemaSnapshot } from '@directus/sdk';

import { MAX_VIOLATIONS_SHOWN } from '@/constants/run';
import { clientFor, type TDirectusClient } from '@/lib/directus/client';
import type { TResult, TRow } from '@/models/common';
import type { TConnection } from '@/models/connection';
import type { TDryRunLine, TDryRunReport } from '@/models/dryRun';
import { keepsRow, pickedKeys, type TRecordPicks } from '@/models/plan';
import { withResult } from '@/utils/result';

import { primaryKeyOf, realColumnsOf } from './data';
import { orMissing } from './errors';
import { readAll, readKeys } from './paging';
import { expandPicks, foreignKeysOf, type TPickRelation } from './picks';

const readTargetKeys = async (
  client: TDirectusClient,
  collection: string,
  primaryKey: string,
) =>
  (await orMissing(readKeys(client, collection, primaryKey))) ??
  new Set<string>();

export const dryRun = (
  source: TConnection,
  target: TConnection,
  collections: string[],
  schemaChanges: number,
  records: TRecordPicks = {},
): Promise<TResult<TDryRunReport>> =>
  withResult(async () => {
    const from = clientFor(source);
    const to = clientFor(target);

    const snapshot = await from.request(schemaSnapshot());
    const relations = foreignKeysOf(snapshot);

    const primaryKeys = new Map(
      collections.map((collection) => [
        collection,
        primaryKeyOf(snapshot, collection),
      ]),
    );

    const sourceRows = new Map<string, TRow[]>();
    const targetKeys = new Map<string, ReadonlySet<string>>();

    for (const collection of collections) {
      const primaryKey = primaryKeys.get(collection) ?? 'id';

      const [rows, keys] = await Promise.all([
        readAll(
          from,
          collection,
          primaryKey,
          realColumnsOf(snapshot, collection),
        ),
        readTargetKeys(to, collection, primaryKey),
      ]);

      sourceRows.set(collection, rows);
      targetKeys.set(collection, keys);
    }

    const picks = expandPicks({
      picks: records,
      relations,
      rows: sourceRows,
      primaryKeys,
      inTarget: targetKeys,
    }).picks;

    const availableKeys = await keysAfterRun({
      to,
      snapshot,
      relations,
      collections,
      picks,
      primaryKeys,
      sourceRows,
      targetKeys,
    });

    const lines = collections.map((collection) =>
      inspect({
        collection,
        primaryKey: primaryKeys.get(collection) ?? 'id',
        rows: (sourceRows.get(collection) ?? []).filter((row) =>
          keepsRow(
            pickedKeys(picks, collection),
            row[primaryKeys.get(collection) ?? 'id'],
          ),
        ),
        targetKeys: targetKeys.get(collection) ?? new Set<string>(),
        relations: relations.filter(
          (relation) => relation.collection === collection,
        ),
        availableKeys,
      }),
    );

    return {
      ranAt: new Date().toISOString(),
      schemaChanges,
      lines,
      totalRows: lines.reduce(
        (total, line) => total + line.toCreate + line.toUpdate,
        0,
      ),
      totalViolations: lines.reduce(
        (total, line) => total + line.violations.length,
        0,
      ),
    };
  });

const keysAfterRun = async ({
  to,
  snapshot,
  relations,
  collections,
  picks,
  primaryKeys,
  sourceRows,
  targetKeys,
}: {
  to: TDirectusClient;
  snapshot: SchemaSnapshotOutput;
  relations: TPickRelation[];
  collections: string[];
  picks: TRecordPicks;
  primaryKeys: Map<string, string>;
  sourceRows: Map<string, TRow[]>;
  targetKeys: Map<string, ReadonlySet<string>>;
}) => {
  const available = new Map<string, ReadonlySet<string>>();

  for (const collection of collections) {
    const primaryKey = primaryKeys.get(collection) ?? 'id';
    const picked = pickedKeys(picks, collection);

    available.set(
      collection,
      new Set([
        ...(targetKeys.get(collection) ?? []),
        ...(sourceRows.get(collection) ?? [])
          .filter((row) => keepsRow(picked, row[primaryKey]))
          .map((row) => String(row[primaryKey])),
      ]),
    );
  }

  const inRun = new Set(collections);

  for (const relation of relations) {
    if (!inRun.has(relation.collection)) continue;
    if (available.has(relation.related)) continue;

    available.set(
      relation.related,
      await readTargetKeys(
        to,
        relation.related,
        primaryKeyOf(snapshot, relation.related),
      ),
    );
  }

  return available;
};

const inspect = ({
  collection,
  primaryKey,
  rows,
  targetKeys,
  relations,
  availableKeys,
}: {
  collection: string;
  primaryKey: string;
  rows: TRow[];
  targetKeys: ReadonlySet<string>;
  relations: TPickRelation[];
  availableKeys: Map<string, ReadonlySet<string>>;
}): TDryRunLine => {
  const violations = new Set<string>();

  let toCreate = 0;
  let toUpdate = 0;

  for (const row of rows) {
    if (targetKeys.has(String(row[primaryKey]))) toUpdate += 1;
    else toCreate += 1;

    for (const relation of relations) {
      const value = row[relation.field];
      if (value === null || value === undefined) continue;

      const known = availableKeys.get(relation.related);
      if (known && !known.has(String(value))) {
        violations.add(
          `${collection}.${relation.field} → ${relation.related}:${String(value)} ` +
            `will not be in the target — select ${relation.related} (or that record) too`,
        );
      }
    }
  }

  return {
    collection,
    toCreate,
    toUpdate,

    violations: [...violations].slice(0, MAX_VIOLATIONS_SHOWN),
  };
};
