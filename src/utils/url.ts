export const withoutTrailingSlash = (path: string) =>
  path.endsWith('/') ? path.slice(0, -1) : path;
