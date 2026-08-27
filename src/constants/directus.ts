export const API_PROXY_URL = '/api/directus';

const SYSTEM_PREFIX = 'directus_';

export const SYSTEM_COLLECTIONS = {
  files: 'directus_files',
  folders: 'directus_folders',
  users: 'directus_users',
} as const;

export const isSystemName = (collection: string) =>
  collection.startsWith(SYSTEM_PREFIX);

export const DIRECTUS_URL_HEADER = 'x-directus-url';

export const DIRECTUS_URL_PARAM = '_directus';

export const DIRECTUS_UPSTREAM_HEADER = 'x-directus-upstream';

export const API_FILES_URL = '/files';
