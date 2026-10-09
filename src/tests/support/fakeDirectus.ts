import type { TDirectusClient } from '@/lib/directus/client';
import type { TRow } from '@/models/common';

type TFieldSeed = {
  nullable?: boolean;
  unique?: boolean;
  special?: string[];
  type?: string;
};

type TCollectionSeed = {
  primaryKey?: string;
  singleton?: boolean;
  fields: Record<string, TFieldSeed>;
  rows?: TRow[];
};

type TSeed = {
  collections: Record<string, TCollectionSeed>;
  relations?: { collection: string; field: string; related: string }[];
  files?: TRow[];
  folders?: TRow[];
};

type TRequest = { method: string; path: string; body: unknown };

type TField = {
  collection: string;
  field: string;
  type: string;
  meta: { required: boolean; special: string[] | null };
  schema: {
    is_primary_key: boolean;
    is_nullable: boolean;
    is_unique: boolean;
    default_value: null;
    has_auto_increment: boolean;
  };
};

type TTable = {
  primaryKey: string;
  singleton: boolean;
  fields: Map<string, TField>;
  rows: Map<string, TRow>;
};

export const httpError = (status: number, code: string, message = code) => ({
  errors: [{ message, extensions: { code } }],
  response: { status },
});

const forbidden = () => httpError(403, 'FORBIDDEN');

/**
 * Just enough of the Directus REST surface for the runner: items, fields,
 * files, folders and the schema snapshot, held in memory. It enforces NOT NULL
 * on writes and on tightening a column, which is what the two-pass run and
 * its constraint relaxing exist to get around.
 */
export const fakeDirectus = (seed: TSeed) => {
  const tables = new Map<string, TTable>();

  for (const [name, table] of Object.entries(seed.collections)) {
    const primaryKey = table.primaryKey ?? 'id';

    tables.set(name, {
      primaryKey,
      singleton: table.singleton ?? false,
      fields: new Map(
        Object.entries<TFieldSeed>({ [primaryKey]: {}, ...table.fields }).map(
          ([field, spec]) => [
            field,
            {
              collection: name,
              field,
              type: spec.type ?? 'string',
              meta: { required: false, special: spec.special ?? null },
              schema: {
                is_primary_key: field === primaryKey,
                is_nullable:
                  field === primaryKey ? false : spec.nullable !== false,
                is_unique: spec.unique === true,
                default_value: null,
                has_auto_increment: false,
              },
            },
          ],
        ),
      ),
      rows: new Map(
        (table.rows ?? []).map((row) => [String(row[primaryKey]), { ...row }]),
      ),
    });
  }

  const files = new Map((seed.files ?? []).map((row) => [String(row.id), row]));
  const folders = new Map(
    (seed.folders ?? []).map((row) => [String(row.id), row]),
  );

  const requests: TRequest[] = [];

  const state = {
    // Return an error to make a matching request fail.
    failWhen: undefined as ((request: TRequest) => unknown) | undefined,
  };

  const tableOf = (name: string) => {
    const table = tables.get(name);
    if (!table) throw forbidden();
    return table;
  };

  const blank = (value: unknown) => value === null || value === undefined;

  const assertFilled = (table: TTable, row: TRow) => {
    for (const field of table.fields.values()) {
      if (field.schema.is_primary_key || field.schema.is_nullable) continue;

      if (blank(row[field.field])) {
        throw httpError(400, 'NOT_NULL_VIOLATION', `${field.field} is null`);
      }
    }
  };

  const page = (rows: TRow[], params: Record<string, unknown> = {}) => {
    const filter = params.filter as
      Record<string, { _in?: unknown[] }> | undefined;
    const fields = params.fields as string[] | undefined;
    const offset = Number(params.offset ?? 0);
    const limit = Number(params.limit ?? 100);

    return rows
      .filter((row) =>
        Object.entries(filter ?? {}).every(([field, rule]) =>
          (rule._in ?? []).map(String).includes(String(row[field])),
        ),
      )
      .slice(offset, offset + limit)
      .map((row) =>
        fields
          ? Object.fromEntries(fields.map((name) => [name, row[name] ?? null]))
          : { ...row },
      );
  };

  const items = (
    method: string,
    name: string,
    params: Record<string, unknown> | undefined,
    body: unknown,
  ) => {
    const table = tableOf(name);
    const keyOf = (row: TRow) => String(row[table.primaryKey]);

    if (method === 'GET') {
      const rows = [...table.rows.values()].sort((a, b) =>
        keyOf(a).localeCompare(keyOf(b), undefined, { numeric: true }),
      );
      const found = page(rows, params);

      return table.singleton ? (found[0] ?? null) : found;
    }

    if (method === 'POST') {
      const created = body as TRow[];

      for (const row of created) {
        if (table.rows.has(keyOf(row))) {
          throw httpError(400, 'RECORD_NOT_UNIQUE');
        }
        assertFilled(table, row);
      }

      for (const row of created) table.rows.set(keyOf(row), { ...row });
      return created;
    }

    if (method === 'PATCH' && !Array.isArray(body)) {
      const [key = 'singleton'] = table.rows.keys();
      table.rows.set(key, { ...table.rows.get(key), ...(body as TRow) });
      return table.rows.get(key);
    }

    if (method === 'PATCH') {
      const merged = (body as TRow[]).map((row) => {
        const held = table.rows.get(keyOf(row));
        if (!held) throw forbidden();

        const next = { ...held, ...row };
        assertFilled(table, next);
        return next;
      });

      for (const row of merged) table.rows.set(keyOf(row), row);
      return merged;
    }

    if (method === 'DELETE') {
      for (const key of (body as { keys: unknown[] }).keys) {
        table.rows.delete(String(key));
      }
      return null;
    }

    throw httpError(405, 'METHOD_NOT_ALLOWED');
  };

  const fields = (method: string, parts: string[], body: unknown) => {
    if (parts.length === 0) {
      return [...tables.values()].flatMap((table) => [
        ...table.fields.values(),
      ]);
    }

    const table = tableOf(parts[0]);
    if (parts.length === 1) return [...table.fields.values()];

    const field = table.fields.get(parts[1]);
    if (!field || method !== 'PATCH') throw forbidden();

    const patch = body as { meta?: object; schema?: TField['schema'] };

    if (patch.schema?.is_nullable === false) {
      for (const row of table.rows.values()) {
        if (blank(row[field.field])) {
          throw httpError(
            400,
            'INVALID_PAYLOAD',
            `${field.field} contains nulls`,
          );
        }
      }
    }

    Object.assign(field.meta, patch.meta);
    Object.assign(field.schema, patch.schema);
    return field;
  };

  const store = (
    method: string,
    rows: Map<string, TRow>,
    params: Record<string, unknown> | undefined,
    body: unknown,
  ) => {
    if (method === 'GET') return page([...rows.values()], params);

    const row = body as TRow;
    rows.set(String(row.id), row);
    return row;
  };

  const route = (
    method: string,
    path: string,
    params: Record<string, unknown> | undefined,
    body: unknown,
  ) => {
    const [, head, ...rest] = path.split('/');

    if (path === '/schema/snapshot') return snapshot();
    if (path === '/users/me') return { id: 'admin' };
    if (head === 'items') return items(method, rest[0], params, body);
    if (head === 'fields') return fields(method, rest, body);
    if (head === 'files') return store(method, files, params, body);
    if (head === 'folders') return store(method, folders, params, body);

    throw httpError(404, 'ROUTE_NOT_FOUND', path);
  };

  const snapshot = () => ({
    version: 1,
    directus: '11.0.0',
    vendor: 'postgres',
    collections: [...tables].map(([collection, table]) => ({
      collection,
      meta: { singleton: table.singleton },
    })),
    fields: [...tables.values()].flatMap((table) =>
      [...table.fields.values()].map((field) => structuredClone(field)),
    ),
    relations: (seed.relations ?? []).map((relation) => ({
      collection: relation.collection,
      field: relation.field,
      related_collection: relation.related,
    })),
  });

  const client = {
    request: async (command: () => Record<string, unknown>) => {
      const {
        path,
        method = 'GET',
        params,
        body,
      } = command() as {
        path: string;
        method?: string;
        params?: Record<string, unknown>;
        body?: string;
      };

      const request = {
        method,
        path,
        body: body ? JSON.parse(body) : undefined,
      };
      requests.push(request);

      const failure = state.failWhen?.(request);
      if (failure) throw failure;

      return route(method, path, params, request.body);
    },
  } as unknown as TDirectusClient;

  return {
    client,
    state,
    requests,
    rows: (collection: string) => [...tableOf(collection).rows.values()],
    field: (collection: string, field: string) =>
      tableOf(collection).fields.get(field),
    files: () => [...files.values()],
    writes: () =>
      requests.filter(
        (request) =>
          request.method !== 'GET' && request.path !== '/schema/diff',
      ),
  };
};
