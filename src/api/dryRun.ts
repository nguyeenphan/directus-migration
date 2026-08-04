import type { SchemaSnapshotOutput } from '@directus/sdk';
import { schemaSnapshot } from '@directus/sdk';

import { MAX_VIOLATIONS_SHOWN } from '@/constants/run';
import type { TResult } from '@/models/common';
import type { TConnection } from '@/models/connection';
import type { TDryRunLine, TDryRunReport } from '@/models/dryRun';
import { clientFor, type TDirectusClient } from '@/providers/directusClient';
import { withResult } from '@/utils/result';

import { orMissing, primaryKeyOf, realColumnsOf } from './data';
import { readAll, readKeys } from './paging';

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
): Promise<TResult<TDryRunReport>> =>
  withResult(async () => {
    const from = clientFor(source);
    const to = clientFor(target);

    const snapshot = await from.request(schemaSnapshot());

    const availableKeys = new Map<string, Set<string>>();

    for (const collection of collections) {
      const primaryKey = primaryKeyOf(snapshot, collection);
      const [sourceKeys, targetKeys] = await Promise.all([
        readKeys(from, collection, primaryKey),
        readTargetKeys(to, collection, primaryKey),
      ]);

      availableKeys.set(collection, new Set([...sourceKeys, ...targetKeys]));
    }

    const lines: TDryRunLine[] = [];

    for (const collection of collections) {
      lines.push(await inspect(from, to, snapshot, collection, availableKeys));
    }

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

const inspect = async (
  from: TDirectusClient,
  to: TDirectusClient,
  snapshot: SchemaSnapshotOutput,
  collection: string,
  availableKeys: Map<string, Set<string>>,
): Promise<TDryRunLine> => {
  const primaryKey = primaryKeyOf(snapshot, collection);
  const columns = realColumnsOf(snapshot, collection);
  const violations: string[] = [];

  const relations = snapshot.relations.filter(
    (relation) =>
      relation.collection === collection && relation.related_collection,
  );

  const [sourceRows, targetKeys] = await Promise.all([
    readAll(from, collection, primaryKey, columns),
    readTargetKeys(to, collection, primaryKey),
  ]);

  let toCreate = 0;
  let toUpdate = 0;

  for (const row of sourceRows) {
    if (targetKeys.has(String(row[primaryKey]))) toUpdate += 1;
    else toCreate += 1;

    for (const relation of relations) {
      const value = row[relation.field];
      if (value === null || value === undefined) continue;

      const known = availableKeys.get(relation.related_collection!);
      if (known && !known.has(String(value))) {
        violations.push(
          `${collection}.${relation.field} → ${relation.related_collection}:${String(value)} does not exist`,
        );
      }
    }
  }

  return {
    collection,
    toCreate,
    toUpdate,

    violations: violations.slice(0, MAX_VIOLATIONS_SHOWN),
  };
};
