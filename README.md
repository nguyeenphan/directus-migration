# directus-migration

Copies schema and content between two Directus instances. Next.js 16 app router,
shadcn/ui, `@directus/sdk`.

## Getting started

```bash
make install
make dev      # http://localhost:3000 -> redirects to /vi or /en
make check    # lint + test + build
```

Both instances are entered in the UI — a URL and a static admin token per side.
Nothing is read from `.env`, and nothing is persisted: a reload loses the plan.

## Environment variables

Only one, and it is optional:

```bash
DIRECTUS_ALLOWED_HOSTS=cms.example.com,staging.example.com
```

Unset means the proxy will forward to any `http(s)` host the server can reach —
an open proxy. Set it in any deployment strangers can load.

## The proxy

The browser never talks to Directus directly. Every call goes through
[src/app/api/directus/[...path]/route.ts](src/app/api/directus/[...path]/route.ts),
which forwards to the upstream named in the `X-Directus-Url` header (or the
`_directus` query param, for `<img>` tags that cannot set headers). Only
`authorization`, `content-type` and `accept` are forwarded up; `set-cookie` is
dropped on the way back. This dodges CORS and keeps one place to log every
request.

## The wizard

Four steps, `connect → schema → data → apply`. Which steps are reachable is
derived on every render by [src/models/flow.ts](src/models/flow.ts) — never
remembered — so a changed connection or a stale plan cannot leave a step open
behind the user. A plan carries the fingerprint of the pair it was built
against; change either side and it reads as stale.

Every write asks for the target host to be typed back first — schema-only runs
included. No environment is treated as special: the confirmation is the same
whether the target is local or production.

## How a run works

Adapted from the [official Directus migration bundle](https://github.com/directus-labs/extensions/tree/main/packages/migration-bundle).
Four stages, in order:

1. **Backup** — the target's snapshot plus every row of every selected
   collection, held in memory. If it fails, nothing is written.
2. **Schema** — `schema/diff` on the target against the source snapshot, then
   `schema/apply`. Unticked collections are dropped from the diff, so they stay
   untouched. Mirror mode (`force`): what is in target but not in source is
   deleted.
3. **Files and folders** — metadata only; bytes are mirrored outside this app.
4. **Data**, in two passes over every selected collection:
   - constraints on the target are relaxed (`required`, `NOT NULL`, `UNIQUE`), then
   - **pass 1** inserts rows holding nothing but their primary key, skipping keys the target already has, then
   - **pass 2** fills every row in with `updateItemsBatch`, and
   - the constraints are restored in a `finally`.

Two passes mean a row can reference any other row no matter which collection
lands first, so **no dependency ordering is needed**. Skipping existing keys
means **a failed run is safe to simply run again** — it continues where it left
off.

The run lives on the server ([src/providers/runStore.ts](src/providers/runStore.ts),
last 20 runs, in memory) and the screen polls it. Stop is cooperative: it takes
effect at the next collection boundary. Rollback restores the backup rows —
data only, the schema is not undone.

### Known limitation: id sequences

Collections with an auto-increment integer primary key keep their original ids,
which does **not** advance the target's sequence — the next record created in
the CMS would collide. There is no Directus endpoint for this, so the run
screen prints the `setval` SQL to run on the target. It reads `MAX(id)`, so run
it only after the rows have landed.

`user_created` and `user_updated` are stripped before writing, because
`directus_users` is never migrated. Anything the target shows as "created by"
therefore reflects the migration run, not the original record.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/[lang]/migrate/` | The wizard: `page.tsx`, `operations.ts` (server actions), and `components/` split per step. |
| `src/app/api/directus/` | The upstream proxy. |
| `src/api/` | One module per concern — the only place that talks to Directus. |
| `src/components/` | Components shared by more than one step (plus vendored `ui/`). |
| `src/constants/` | Values: steps, stages, batch and page sizes, style maps. |
| `src/contexts/` | React contexts. |
| `src/hooks/` | The wizard's state, one hook per concern. |
| `src/models/` | Domain types and pure functions over them — the flow gate, plan and run shapes. |
| `src/providers/` | Server-side: the Directus client, the run store, the dictionary loader. |
| `src/routes/` | `ROUTES` + `route(lang, path, query)` for locale-aware navigation. |
| `src/tests/` | `node:test` suites over the pure functions. `npm test`. |
| `src/utils/` | Small pure helpers: `cn`, `chunkArray`, `withResult`, `wordDiff`. |
| `public/locales/<locale>/common.json` | Translation files, served as static assets. |

## i18n

Locale comes from the URL (`/vi/...`, `/en/...`). [src/proxy.ts](src/proxy.ts)
redirects unprefixed requests using `Accept-Language`, falling back to
`DEFAULT_LOCALE`. Dictionaries are typed off `en.json`, so a missing key in
`vi.json` is a TypeScript error.

Files are camelCase; `page.tsx`, `layout.tsx`, `actions.ts` and `route.ts` keep
the names Next requires.
