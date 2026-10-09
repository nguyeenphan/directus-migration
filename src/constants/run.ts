export const RUN_STAGES = ['backup', 'schema', 'files', 'data'] as const;

export const WRITE_BATCH_SIZE = 50;

export const READ_PAGE_SIZE = 200;

export const COMPARE_PAGE_SIZE = 500;

export const KEY_PAGE_SIZE = 5000;

// Collections compared at once while planning. Kept low: each one is a full
// read of both instances, and the source is usually production.
export const COMPARE_CONCURRENCY = 2;

export const MAX_DETAIL_RECORDS = 500;

// Ids per `_in` filter — they travel in the query string of a GET.
export const ID_FILTER_SIZE = 100;

export const MAX_VIOLATIONS_SHOWN = 10;

export const RUN_POLL_INTERVAL_MS = 1000;

// 0.5s, 1s, 2s, 4s between tries — long enough for a Directus that reports
// "under pressure" to catch its breath.
export const RETRY_ATTEMPTS = 5;

export const RETRY_BASE_DELAY_MS = 500;

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
