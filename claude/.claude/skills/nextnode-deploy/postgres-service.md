# Postgres Service Abstraction

Per-project PostgreSQL, modeled as a backing service. Declared in `[services.postgres]`, provisioned during `provision`, env contributions threaded into the deployed app at `deploy` time, migrations applied by a dedicated `migrate-remote` CI job between `provision` and `deploy`.

Two modes are supported:

- **`embedded`** - a postgres container runs as a sidecar in the same compose stack as the app (default for NextNode-managed deploys). The infra also provisions a per-project R2 bucket and a backup sidecar that pushes daily dumps with GFS retention.
- **`external`** - the project consumes a managed database elsewhere. The infra only routes `DATABASE_URL` from repo secrets into the app; no sidecar, no backups, no migrations safety net.

## Config

```toml
[services.postgres]
mode = "embedded"               # or "external"
migrations_folder = "drizzle"   # optional, defaults to "drizzle/"
migrate_command = "pnpm drizzle-kit migrate"   # optional, this is the CLI default
check_command   = "pnpm drizzle-kit check"     # optional, this is the CLI default
```

Validation lives in `config/validation/services/postgres.ts`. Each field is optional (except `mode`), and each defaults to `undefined` at the type level so callers (`migrate-remote`, the quality matrix) can apply named constants from `domain/deploy/target.ts` rather than re-inlining defaults.

## NextNode-blessed version (fleet-wide pin)

`NEXTNODE_POSTGRES_VERSION` in `domain/services/postgres.ts` is the single source of truth for both:

- the embedded server image: `postgres:<v>`
- the backup sidecar image: `ghcr.io/solectrus/postgres-s3-backup:<v>`

NextNode runs an externalized-CTO model: clients do not pick their postgres version. The constant is bumped once and the next pipeline run rolls the new major across every embedded deploy. `mode = "external"` users own their version and are unaffected.

## Embedded mode - compose topology

Three services land in the rendered compose file (`buildPostgresSidecar`, `buildPostgresBackupSidecar`):

| Service | Image | Network | Host port | Purpose |
|---------|-------|---------|-----------|---------|
| `<declared-service-name>` | (project Dockerfile or upstream ref) | project network + reverse-proxy | allocated via `allocateHostPort` | the user app, `depends_on: postgres (healthy)` |
| `postgres` | `postgres:<NEXTNODE_POSTGRES_VERSION>` | project network only | **none** (never bound to a host port) | the database; data volume is the named `postgres-data` mounted at `/var/lib/postgresql/data` |
| `postgres-backup` | `ghcr.io/solectrus/postgres-s3-backup:<NEXTNODE_POSTGRES_VERSION>` | project network only | none | runs `@daily`, pushes a dump to the project's R2 backup bucket |

Postgres is reachable from the app as `postgres:5432` on the internal docker network, never from outside the VPS.

## Identifiers and naming (pure logic)

`domain/services/postgres.ts` owns the naming - never hand-build strings:

```typescript
postgresProjectIdentifier('my-app')
// -> 'my_app' (dashes replaced with underscores so unquoted SQL stays valid)

postgresBackupBucketName('my-app')
// -> 'nn-backups-my-app'

buildPostgresEmbeddedDatabaseUrl('my-app', '<password>')
// -> 'postgres://my_app:<password>@postgres:5432/my_app'
```

The project identifier is used for `POSTGRES_USER` AND `POSTGRES_DB` (not the image defaults `postgres/postgres`) so the role + DB are unambiguous in `pg_dump`, `psql \du`, and monitoring labels.

## Provisioning (provision command)

For `mode = "embedded"`:

1. The postgres service factory (`cli/services/postgres/postgres.service.ts`) runs `ensureR2Bucket` on `nn-backups-<project>` - idempotent, created if absent, uses `R2_BUCKET_LOCATION_HINT` like every other infra bucket.
2. State is persisted as part of the standard service-env flow; the bucket name is recomputed deterministically per deploy so no per-project state file is needed.

For `mode = "external"`: provision is a no-op.

The factory consumes a `ServiceFactoryContext` that exposes `cfToken` + `infraStorage.accountId` (forced loaded by `requiresInfraStorage`) so it can call the Cloudflare R2 admin API without inheriting cross-adapter coupling.

## Runtime contract (deploy command)

Embedded mode contributes:

```typescript
buildPostgresEmbeddedEnv(projectName, password)
// {
//   public: { POSTGRES_USER: '<id>', POSTGRES_DB: '<id>' },
//   secret: { POSTGRES_PASSWORD: '<pw>', DATABASE_URL: 'postgres://...' }
// }
```

External mode contributes:

```typescript
buildPostgresExternalEnv(databaseUrl)
// { public: {}, secret: { DATABASE_URL: databaseUrl } }
```

The user/DB names are derived from the project name (not secrets), so they travel on the public channel - only the password and the URL (which embeds the password) are masked through the secret channel.

### Required repo secrets

| Mode | Secret | What for |
|------|--------|----------|
| `embedded` | `POSTGRES_PASSWORD` | seeds `initdb` on first boot, embedded in `DATABASE_URL` |
| `external` | `DATABASE_URL` | full `postgres://user:pw@host/db` URL to the managed DB |

Missing-secret = factory throws at deploy time (loud failure, never a silent fallback).

## Migrations (`migrate-remote` deploy command)

A dedicated CI job runs between `provision` and `deploy`. Skipped (early-exit) when the project does not declare `[services.postgres]`. For declared projects:

1. **Stage the rollout** on the target - env file synced, compose file rendered, registry login, image pull, `postgres` service up + healthy.
2. **Take a pre-migrate snapshot** via `target.runPreMigrateSnapshot()` - calls the backup sidecar on-demand (the solectrus image exposes `sh backup.sh`). Skipped in `mode = "external"` (user owns backups). A failure here halts the workflow before `migrate` runs.
3. **Run the migrate command** in an ephemeral container joined to the project's docker network (`target.runMigrate()`). Default command: `pnpm drizzle-kit migrate` (`DEFAULT_MIGRATE_COMMAND` in `domain/deploy/target.ts`). Override per project via `migrate_command`.

The snapshot is the rollback safety net. A migration failure does NOT delete the snapshot - it stays in R2 for `restore`, which picks the right dump by timestamp.

### Why migrations don't run from the app entrypoint

Two replicas rotating during a redeploy would both try to acquire the schema; if one beats the other, the slower one starts against a half-migrated schema. The advisory-lock approach (`pg_advisory_lock`) only serializes; it does NOT roll back. The `migrate-remote` job runs once, gated, with a snapshot.

### Quality-matrix integration

When `[services.postgres]` is declared, the quality matrix adds a `drizzle-check` task (`check_command`, default `pnpm drizzle-kit check`) that runs on the GH runner during the quality stage. Pure filesystem check, no DB - validates the local migrations folder before any deploy artifact is produced.

## Backups (sidecar + retention)

The backup sidecar runs on the schedule `@daily` and writes objects keyed:

```
s3://nn-backups-<project>/postgres/<project_id>_<YYYY-MM-DDTHH:MM:SS>.dump
```

Format is the upstream image's own (`<POSTGRES_DATABASE>_<timestamp>.dump`, timestamp = `date +%Y-%m-%dT%H:%M:%S` - colons, no `Z`, no millis) - the parser regex mirrors it exactly.

### GFS retention - `selectPostgresBackupsToPrune`

Pure function. Inputs: a list of parsed snapshots. Output: the subset to delete.

- Keep the newest snapshot in each of the **7 most-recent UTC days** (daily bucket)
- Keep the newest snapshot in each of the **4 most-recent ISO weeks** (Monday-aligned)
- Keep the newest snapshot in each of the **3 most-recent UTC months**

Buckets overlap on the newest snapshot, so the worst-case upper bound is 7 + 4 + 3 = 14. With dense daily data the realized count is typically lower because the most-recent weekly and the two most-recent monthly buckets overlap the 7-day window. Constants: `POSTGRES_BACKUP_RETENTION_DAILY`, `_WEEKLY`, `_MONTHLY`.

`parsePostgresBackupKey` round-trips through `new Date(iso)` and rejects keys that don't survive the round trip (Feb 30, Apr 31, etc.) - so a malformed or hand-crafted key cannot be classified into a bucket it doesn't belong to and displace a real snapshot.

### Pruning (cron via the same sidecar)

Pruning runs as part of the same backup flow - listing the existing keys via the R2 backup-store adapter, computing the prune set, deleting via the S3 SDK.

## Restore (standalone `restore` command)

Destructive: `pg_restore --clean` drops + recreates the target objects before restoring. Argv shape:

```
infrastructure restore --project <slug> --at <iso-date> --yes
```

- `--project` selects which project's R2 bucket to read from.
- `--at` is an ISO date/time; `selectPostgresBackupForRestore` picks the latest snapshot whose timestamp is **<= --at** (inclusive boundary). Date-only strings resolve to midnight UTC.
- `--yes` is the destructive-confirmation gate (`ensurePostgresRestoreConfirmed` throws without it).

Unknown flags are rejected (`node:util parseArgs` strict mode) so a typo like `--yess` cannot defeat the gate.

The runner (`adapters/postgres/restore-runner.ts`) feeds the password to libpq via `PGPASSWORD` (not argv) so it stops appearing in `ps aux` / `/proc/<pid>/cmdline`. `redactPostgresPassword` is the pure helper that splits the URL.

## Teardown

`teardown` on a postgres-using project:

1. Stops + removes every declared user service (`<name>`), `postgres`, `postgres-backup`
2. **Preserves the `postgres-data` named volume by default** (state survives) - pass `wipeBackups` to drop it along with the R2 backup objects via `wipePostgresBackups`
3. Removes the per-project R2 backup bucket only when `wipeBackups` is set

`teardown-guard` validates this is safe before destruction.

## Rules

1. **Migrations run from CI, never from the app** - the `migrate-remote` job is the only sanctioned migration path. App entrypoints that run `drizzle-kit migrate` on startup are a bug.
2. **One blessed postgres version** - bump `NEXTNODE_POSTGRES_VERSION` to roll a new major across embedded deploys. Never override per project.
3. **Postgres is internal-only** - the sidecar must not bind a host port. The app reaches it via the docker compose service name on the internal network.
4. **Identifiers are derived, never typed** - `postgresProjectIdentifier`, `postgresBackupBucketName`, `buildPostgresEmbeddedDatabaseUrl` are the only sources of truth.
5. **The user/DB names live on the public channel; the password and `DATABASE_URL` live on the secret channel** - `mergeServiceEnvs` enforces the partition, but the design is "credentials in the secret half".
6. **Snapshot before migrate, never after** - `runPreMigrateSnapshot` runs before `runMigrate`. A migration failure leaves the snapshot intact in R2 for `restore` to pick up.
7. **Volumes are preserved on teardown by default** - lost postgres data on a redeploy or accidental teardown would be a catastrophic NextNode-side bug. `wipeBackups` is opt-in.
