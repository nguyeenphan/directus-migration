export const API_PROXY_URL = '/api/directus';

export const SYSTEM_PREFIX = 'directus_';

export const SYSTEM_COLLECTIONS = {
  files: 'directus_files',
  folders: 'directus_folders',
  users: 'directus_users',
} as const;

export const isSystemName = (collection: string) =>
  collection.startsWith(SYSTEM_PREFIX);

export const THUMBNAIL_SIZE = 96;

export const DIRECTUS_URL_HEADER = 'x-directus-url';

export const DIRECTUS_URL_PARAM = '_directus';

export const DIRECTUS_UPSTREAM_HEADER = 'x-directus-upstream';

export const API_GET_SERVER_INFO_URL = '/server/info';

export const API_GET_CURRENT_USER_URL = '/users/me';

export const API_GET_SCHEMA_SNAPSHOT_URL = '/schema/snapshot';

export const API_POST_SCHEMA_DIFF_URL = '/schema/diff';

export const API_POST_SCHEMA_APPLY_URL = '/schema/apply';

export const API_GET_FIELDS_URL = '/fields';
export const API_GET_RELATIONS_URL = '/relations';

export const API_ITEMS_URL = '/items';

export const API_FILES_URL = '/files';
export const API_FOLDERS_URL = '/folders';
export const API_ASSETS_URL = '/assets';

export const apiFieldsOfUrl = (collection: string) =>
  `${API_GET_FIELDS_URL}/${collection}`;

export const apiFieldUrl = (collection: string, field: string) =>
  `${API_GET_FIELDS_URL}/${collection}/${field}`;

export const apiAssetUrl = (id: string) => `${API_ASSETS_URL}/${id}`;

const SYSTEM_COLLECTION_URLS: Record<string, string> = {
  [SYSTEM_COLLECTIONS.files]: API_FILES_URL,
  [SYSTEM_COLLECTIONS.folders]: API_FOLDERS_URL,
};

export const isSystemCollection = (collection: string) =>
  collection in SYSTEM_COLLECTION_URLS;

export const apiItemsUrl = (collection: string) =>
  SYSTEM_COLLECTION_URLS[collection] ?? `${API_ITEMS_URL}/${collection}`;
