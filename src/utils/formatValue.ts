export const formatValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

const INVISIBLE_RUN = /[\u200b-\u200d\ufeff]/g;
const SPACE_LIKE = /[\u00a0\u202f\t]/g;

const canonicalText = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_RUN, '')
    .replace(SPACE_LIKE, ' ')
    .trim();

export const canonicalValue = (value: unknown): unknown => {
  if (value === null || value === undefined || value === '') return null;

  if (Array.isArray(value)) return value.map(canonicalValue);

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, canonicalValue(entry)] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  return canonicalText(String(value)) || null;
};

export const isSameValue = (before: unknown, after: unknown) =>
  JSON.stringify(canonicalValue(before)) ===
  JSON.stringify(canonicalValue(after));

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
