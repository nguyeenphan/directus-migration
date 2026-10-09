# directus-migration

Copies schema and content between two Directus instances. Next.js 16 app router,
shadcn/ui, `@directus/sdk`.

## Getting started

Node 20.9

```bash
make install
make dev
make check    # lint + test + build
```

Both instances are entered in the UI — a URL and a static admin token per side.
Nothing is read from `.env`, and nothing is persisted: a reload loses the plan.

## The wizard

Four steps: `connect → schema → data → apply`. Which ones are reachable is
derived on every render by [src/models/flow.ts](src/models/flow.ts), never
remembered, so a changed connection or a stale plan cannot leave a step open
behind the user. While a run is going, every step but the one showing it is
closed. Before applying, a dry run reports row counts and constraint
violations, and every write asks for the target host to be typed back first.

On the data step every record travels unless it is unticked. The review list
is capped and skips hidden fields, so what the user unticks is stored as an
exclusion — a record the list never showed is still migrated.

## How a run works

Adapted from the [official Directus migration bundle](https://github.com/directus-labs/extensions/tree/main/packages/migration-bundle).
Four stages, in order:

1. **Backup** — the target's snapshot plus every row of every selected
   collection, held in memory. If any read fails, nothing is written. The run
   then waits: the backup file has to be downloaded before the first write,
   because a reload would otherwise lose the only copy.
2. **Schema** — `schema/diff` on the target against the source snapshot, then
   `schema/apply`. Unticked collections are dropped from the diff, so they stay
   untouched. Mirror mode (`force`): what is in target but not in source is
   deleted.
3. **Files and folders** — metadata only; bytes are mirrored outside this app.
   Every file row is copied, not only the ones a relation points at, because
   rich text embeds files by id. If this stage fails, no data is written.
4. **Data**. The source is read once and compared with the backup, and only
   rows that are new or different are written:
   - constraints on the target are relaxed (`required`, `NOT NULL`, `UNIQUE`), then
   - **pass 1** inserts the new rows holding nothing but their primary key, then
   - **pass 2** fills the new and the changed rows in with `updateItemsBatch`,
   - mirror mode deletes the rows only the target holds, and
   - the constraints are restored in a `finally`.

Two passes mean a row can reference any other row no matter which collection
lands first, so **no dependency ordering is needed**.

A run never reads as a success unless everything landed. If pass 2 fails or
the run is stopped between the passes, the new rows it left as bare keys are
reported, and so is any constraint that could not be put back (a column still
holding an empty value refuses its `NOT NULL`). Both are recoverable from the
run screen: **Run again** fills the bare keys — that is what the button is for
when the target was overloaded — and **Roll back** removes them; either one
restores the constraints the earlier run left relaxed.

Fields Directus masks on read (`hash`, `conceal`) are never migrated: the
value read back is asterisks, not the secret.

The run lives in the browser tab ([src/lib/directus/runner.ts](src/lib/directus/runner.ts),
state in [src/lib/store/runs.ts](src/lib/store/runs.ts), last 3 runs, in
memory) and the screen polls it. Stop is cooperative: it takes effect at the
next collection boundary. Rollback compares the backup with what the target
holds now and puts back whatever differs, so a rollback that failed can be run
again — data only, the schema is not undone, and file rows the run created are
left in place (deleting them through Directus would delete the stored bytes).

### Known limitation: id sequences

Collections with an auto-increment integer primary key keep their original ids,
which does **not** advance the target's sequence — the next record created in
the CMS would collide. There is no Directus endpoint for this, so the run
screen prints the `setval` SQL to run on the target. It reads `MAX(id)`, so run
it only after the rows have landed.

The four audit columns (`user_created`, `user_updated`, `date_created`,
`date_updated`) go out as `null` on every row a run writes, because
`directus_users` is never migrated. Rows the run does not write keep theirs.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/[lang]/migrate/` | The wizard: `page.tsx`, `operations.ts` (the client-side entry points the hooks call), and `components/` split per step. |
| `src/app/api/directus/` | The upstream proxy route — the only code that runs on the server. |
| `src/lib/directus/` | One module per concern — the only place that talks to Directus. |
| `src/lib/store/` | In-tab state: runs and their backups, and the relaxed constraints still owed to a target (localStorage). |
| `src/lib/i18n/` | The dictionary loader and `translate`. |
| `src/components/` | Components shared by more than one step (plus vendored `ui/`). |
| `src/constants/` | Values: steps, stages, batch and page sizes, style maps. |
| `src/contexts/` | React contexts. |
| `src/hooks/` | The wizard's state, one hook per concern. |
| `src/models/` | Domain types and pure functions over them — the flow gate, plan and run shapes. |
| `src/tests/` | `node:test` suites. `support/fakeDirectus.ts` is an in-memory Directus the runner tests drive. `npm test`. |
| `src/utils/` | Small pure helpers: `cn`, `chunkArray`, `mapLimit`, `withResult`, `wordDiff`. |
| `public/locales/<locale>.json` | Translation files. |

Files are camelCase; `page.tsx`, `layout.tsx`, `actions.ts` and `route.ts` keep
the names Next requires.

## The proxy

Only one, and it is optional:

```bash
DIRECTUS_ALLOWED_HOSTS=cms.example.com,staging.example.com
DIRECTUS_READONLY_HOSTS=cms.example.com
```

The browser never calls Directus directly; Every request goes through
[src/app/api/directus/[...path]/route.ts](src/app/api/directus/[...path]/route.ts),
that forwards to the instance named in the request. Unset, that route will
forward to any `http(s)` host the server can reach — an open proxy. Set it in
any deployment strangers can load.

`DIRECTUS_READONLY_HOSTS` names hosts the proxy will only ever read from: any
request to them other than `GET`/`HEAD` is refused before it leaves the server.
List a production source there and no bug or wrong click in the wizard —
reversing the direction included — can write to it.
