import { readItems } from '@directus/sdk';

import { KEY_PAGE_SIZE, READ_PAGE_SIZE } from '@/constants/run';
import type { TRow } from '@/models/common';
import type { TDirectusClient } from '@/providers/directusClient';
import { asRows } from '@/utils/rows';

export const readPages = async <T>(
  pageSize: number,
  fetchPage: (offset: number) => Promise<T | T[] | null | undefined>,
): Promise<T[]> => {
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = asRows(await fetchPage(offset));

    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
};

export const readAll = (
  client: TDirectusClient,
  collection: string,
  primaryKey: string,
  columns: string[],
  pageSize = READ_PAGE_SIZE,
) =>
  readPages<TRow>(pageSize, (offset) =>
    client.request<TRow[]>(
      readItems(collection, {
        sort: [primaryKey],
        fields: columns,
        limit: pageSize,
        offset,
      }),
    ),
  );

export const readKeys = async (
  client: TDirectusClient,
  collection: string,
  primaryKey: string,
) =>
  new Set(
    (
      await readAll(client, collection, primaryKey, [primaryKey], KEY_PAGE_SIZE)
    ).map((row) => String(row[primaryKey])),
  );
