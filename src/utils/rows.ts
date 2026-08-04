export const asRows = <T>(page: T | T[] | null | undefined): T[] => {
  if (page === null || page === undefined) return [];
  return Array.isArray(page) ? page : [page];
};
