// `sqlLiteral` only doubles quotes. With this off (possible up to
// PostgreSQL 18) a backslash in the data would escape them again.
export const SQL_PREAMBLE = 'SET standard_conforming_strings = on;';

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

export const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'NULL';

  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
};
