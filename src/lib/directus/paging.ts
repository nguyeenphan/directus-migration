import { readItems } from '@directus/sdk';

import { KEY_PAGE_SIZE, READ_PAGE_SIZE } from '@/constants/run';
import type { TDirectusClient } from '@/lib/directus/client';
import type { TRow } from '@/models/common';
import { asRows } from '@/utils/rows';

/**
 * Stops on an empty page, not on a short one, and steps by the rows actually
 * returned. Directus hands back fewer rows than asked whenever a permission
 * filter thins a page or the instance caps the limit below `pageSize` — a
 * short page there means "fewer rows here", never "no rows after this".
 */
export const readPages = async <T>(
  pageSize: number,
  fetchPage: (offset: number) => Promise<T | T[] | null | undefined>,
): Promise<T[]> => {
  const rows: T[] = [];

  for (let offset = 0; ;) {
    const page = asRows(await fetchPage(offset));
    if (page.length === 0) break;

    rows.push(...page);
    offset += page.length;
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
