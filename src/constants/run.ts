export const RUN_STAGES = ['backup', 'schema', 'files', 'data'] as const;

export const WRITE_BATCH_SIZE = 50;

export const READ_PAGE_SIZE = 200;

export const COMPARE_PAGE_SIZE = 500;

export const KEY_PAGE_SIZE = 5000;

export const MAX_DETAIL_RECORDS = 500;

export const MAX_VIOLATIONS_SHOWN = 10;

export const RUN_POLL_INTERVAL_MS = 1000;

export const PROBE_TIMEOUT_MS = 10_000;

export const AUDIT_FIELDS = [
  'user_created',
  'user_updated',
  'date_created',
  'date_updated',
] as const;

export const AUDIT_USER_FIELDS = ['user_created', 'user_updated'] as const;

export const PROTECTED_COLLECTIONS = [
  'directus_users',
  'directus_roles',
  'directus_policies',
  'directus_permissions',
  'directus_sessions',
] as const;
