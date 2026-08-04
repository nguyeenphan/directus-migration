export const formatValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

export const isSameValue = (before: unknown, after: unknown) =>
  JSON.stringify(before ?? null) === JSON.stringify(after ?? null);

const LABEL_FIELDS = [
  'title',
  'name',
  'label',
  'heading',
  'slug',
  'code',
  'filename_download',
];

export const recordLabel = (
  row: Record<string, unknown> | undefined,
  key: string,
) => {
  if (!row) return key;

  for (const field of LABEL_FIELDS) {
    const value = row[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return key;
};
