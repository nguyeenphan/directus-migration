import { readFields, updateField } from '@directus/sdk';

import type { TDirectusClient } from '@/lib/directus/client';
import { withRetry } from '@/utils/retry';

export type TRelaxedField = {
  collection: string;
  field: string;
  meta: Record<string, unknown>;
  schema: Record<string, unknown>;
};

type TField = {
  meta?: { required?: boolean | null; special?: string[] | null } | null;
  schema?: {
    is_nullable?: boolean;
    is_unique?: boolean;
    default_value?: unknown;
  } | null;
};

const seedsRandomUuid = (field: TField) =>
  field.meta?.special?.includes('uuid') === true;

export const withoutUuidSpecial = (special: string[] | null | undefined) => {
  const rest = (special ?? []).filter((entry) => entry !== 'uuid');
  return rest.length > 0 ? rest : null;
};

const hasColumn = (field: TField) =>
  field.schema !== null && field.schema !== undefined;

const blocksSkeletonInsert = (field: TField) => {
  const hasDefault =
    field.schema?.default_value !== null &&
    field.schema?.default_value !== undefined;

  const notNullWithoutDefault =
    field.schema?.is_nullable === false && !hasDefault;

  return (
    notNullWithoutDefault ||
    field.meta?.required === true ||
    field.schema?.is_unique === true
  );
};

type TFieldRecord = TField & { collection: string; field: string };

export const relaxableFields = (
  fields: readonly TFieldRecord[],
  wanted: ReadonlySet<string>,
): TRelaxedField[] =>
  fields
    .filter((field) => wanted.has(field.collection))
    .filter(hasColumn)
    .filter(
      (field) =>
        !(field.schema as { is_primary_key?: boolean } | null)?.is_primary_key,
    )
    .filter((field) => blocksSkeletonInsert(field) || seedsRandomUuid(field))
    .map((field) => ({
      collection: field.collection,
      field: field.field,
      meta: { ...field.meta },
      schema: { ...field.schema },
    }));

export const planRelax = async (
  client: TDirectusClient,
  collections: string[],
): Promise<TRelaxedField[]> => {
  const fields = (await client.request(readFields())) as TFieldRecord[];
  return relaxableFields(fields, new Set(collections));
};

const idOf = (field: TRelaxedField) => `${field.collection}.${field.field}`;

/**
 * A field still relaxed from an earlier run reads as unconstrained, so a fresh
 * plan would record the relaxed state as the one to restore. The definitions
 * held from that earlier run are the real originals and always win.
 */
export const mergeRelaxed = (
  outstanding: readonly TRelaxedField[],
  fresh: readonly TRelaxedField[],
): TRelaxedField[] => {
  const held = new Set(outstanding.map(idOf));

  return [...outstanding, ...fresh.filter((field) => !held.has(idOf(field)))];
};

// One at a time: each call alters a table and flushes the target's schema
// cache, and Directus does not take dozens of those at once gracefully.
export const applyRelax = async (
  client: TDirectusClient,
  relaxed: readonly TRelaxedField[],
) => {
  for (const field of relaxed) {
    await withRetry(() =>
      client.request(
        updateField(field.collection, field.field, {
          meta: {
            ...field.meta,
            required: false,
            special: withoutUuidSpecial(field.meta.special as string[] | null),
          },
          schema: { ...field.schema, is_nullable: true, is_unique: false },
        }),
      ),
    );
  }
};

export type TRestoreFailure = { field: TRelaxedField; error: unknown };

/**
 * Every field is attempted even when one fails — a column still holding a
 * NULL refuses its NOT NULL back, and that must not strand the others.
 */
export const restoreConstraints = async (
  client: TDirectusClient,
  relaxed: readonly TRelaxedField[],
): Promise<TRestoreFailure[]> => {
  const failures: TRestoreFailure[] = [];

  for (const field of relaxed) {
    try {
      await withRetry(() =>
        client.request(
          updateField(field.collection, field.field, {
            meta: field.meta,
            schema: field.schema,
          }),
        ),
      );
    } catch (error) {
      failures.push({ field, error });
    }
  }

  return failures;
};

export const fieldNames = (fields: readonly TRelaxedField[]) =>
  fields.map(idOf).join(', ');
