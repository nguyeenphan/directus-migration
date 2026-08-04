import type { TResult } from '@/models/common';
import type { TConnection } from '@/models/connection';
import type { TPlan } from '@/models/plan';
import { withResult } from '@/utils/result';

import { buildDataPlan } from './data';
import { buildSchemaPlan } from './schema';

export const buildPlan = (
  source: TConnection,
  target: TConnection,
  force: boolean,
  onLog?: (line: string) => void,
): Promise<TResult<TPlan>> =>
  withResult(async () => {
    const { plan: schema, snapshot } = await buildSchemaPlan(
      source,
      target,
      force,
      onLog,
    );

    const added = new Set(
      schema.collections
        .filter((entry) => entry.kind === 'add')
        .map((entry) => entry.collection),
    );

    const data = await buildDataPlan(source, target, snapshot, added, onLog);

    return { generatedAt: new Date().toISOString(), schema, data };
  });
