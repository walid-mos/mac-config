# Postgres Service Abstraction

Per-project PostgreSQL, modeled as a backing service. Declared in `[services.postgres]`, provisioned during `provision`, env contributions threaded into the deployed app at `deploy` time, migrations applied by a dedicated `migrate-remote` CI job between `provision` and `deploy`.

Two modes are supported:

- **`embedded`** - a postgres container runs as a sidecar in the same compose stack as the app (default for NextNode-managed deploys). The infra provisions **two** per-project R2 buckets and runs **two parallel backup systems** (prod only): a `postgres-backup` sidecar that pushes daily pg_dump logical dumps with GFS retention, plus continuous **wal-g** WAL archiving + daily base backups for point-in-time recovery and zero-loss VPS swaps.
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

`NEXTNODE_POSTGRES_VERSION` in `domain/services/postgres.ts` is the single source of truth for:

- the embedded server image: `nextnode-postgres-walg:<v>` — a `postgres:<v>` + wal-g image **built on the VPS** from a context shipped next to the compose file (`POSTGRES_WALG_LOCAL_IMAGE`, never pulled from a registry). In dev the wal-g entrypoint is a no-op and `archive_mode` stays off, so it behaves like stock postgres.
- the pg_dump backup sidecar image: `ghcr.io/solectrus/postgres-s3-backup:<v>`

NextNode runs an externalized-CTO model: clients do not pick their postgres version. The constant is bumped once and the next pipeline run rolls the new major across every embedded deploy. `mode = "external"` users own their version and are unaffected.

## Embedded mode - compose topology

Up to four services land in the rendered compose file (`buildPostgresSidecar`, `buildPostgresWalgSidecar`, `buildPostgresBackupSidecar`). The two backup sidecars are **prod-only** (`buildPostgresServiceGroup` spreads them in conditionally; dev runs zero backups):

| Service | Image | Network | Host port | Purpose |
|---------|-------|---------|-----------|---------|
| `<declared-service-name>` | (project Dockerfile or upstream ref) | project network + reverse-proxy | allocated via `allocateHostPort` | the user app, `depends_on: postgres (healthy)` |
| `postgres` | `nextnode-postgres-walg:<NEXTNODE_POSTGRES_VERSION>` (built on VPS) | project network only | **none** (never bound to a host port) | the database; `archive_command = wal-g wal-push` (prod); restores latest base + replays WAL on an empty data dir. Data volume `postgres-data` at `/var/lib/postgresql/data` |
| `postgres-walg` (prod) | same wal-g image | project network only | none | base-backup loop: `wal-g backup-push` daily (`86400s`), retains `7` FULL backups (`wal-g delete retain FULL`), lz4 |
| `postgres-backup` (prod) | `ghcr.io/solectrus/postgres-s3-backup:<NEXTNODE_POSTGRES_VERSION>` | project network only | none | runs `@daily`, pushes a pg_dump to `<project>-backups-dump` |

Postgres is reachable from the app as `postgres:5432` on the internal docker network, never from outside the VPS.

## Identifiers and naming (pure logic)

`domain/services/postgres.ts` owns the naming - never hand-build strings:

```typescript
postgresProjectIdentifier('my-app')
// -> 'my_app' (dashes replaced with underscores so unquoted SQL stays valid)

postgresBackupBucketName('my-app')
// -> 'my-app-backups-dump'  (pg_dump logical backups)

postgresWalgBucketName('my-app')   // domain/services/postgres-walg.ts
// -> 'my-app-backups'       (wal-g base backups + archived WAL)

buildPostgresEmbeddedDatabaseUrl('my-app', 'secret')
// -> 'postgres://my_app:secret@postgres:5432/my_app'        (alphanumeric unchanged)
buildPostgresEmbeddedDatabaseUrl('my-app', 'aB3+xy/z=')
// -> 'postgres://my_app:aB3%2Bxy%2Fz%3D@postgres:5432/my_app' (password percent-encoded)
```

The password is `encodeURIComponent`-wrapped so URL-reserved bytes (`/ @ : ? # +`) in a base64/special-char secret inherited from a prior stack do not mis-parse the userinfo. `redactPostgresPassword` reverses it (`decodeURIComponent`) when masking.

The project identifier is used for `POSTGRES_USER` AND `POSTGRES_DB` (not the image defaults `postgres/postgres`) so the role + DB are unambiguous in `pg_dump`, `psql \du`, and monitoring labels.

## Provisioning (provision command)

For `mode = "embedded"`:

1. The postgres service factory (`cli/services/postgres/postgres.service.ts`) runs `ensureR2Bucket` on BOTH `<project>-backups` (wal-g) and `<project>-backups-dump` (pg_dump) - idempotent, created if absent, `R2_BUCKET_LOCATION_HINT` like every other infra bucket. One dedicated infra-owned R2 token (`nextnode-postgres-backup-<project>-<env>`) is scoped read+write on both.
2. State is persisted as part of the standard service-env flow; bucket names are recomputed deterministically per deploy so no per-project state file is needed.

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

The user/DB names are derived from the project name (not secrets), so they travel on the public channel - only the password and the URL (which embeds the percent-encoded password) are masked through the secret channel.

### Required repo secrets

| Mode | Secret | What for |
|------|--------|----------|
| `embedded` | `POSTGRES_PASSWORD` | seeds `initdb` on first boot, embedded in `DATABASE_URL` |
| `external` | `DATABASE_URL` | full `postgres://user:pw@host/db` URL to the managed DB |

Missing-secret = factory throws at deploy time (loud failure, never a silent fallback).

## Migrations (`migrate-remote` deploy command)

A dedicated CI job runs between `provision` and `deploy`. Skipped (early-exit) when the project does not declare `[services.postgres]`, **and gated by the `detect-migration-changes` job** (`migrations_changed` output) so it only runs when migration files actually changed. `detectMigrationChangesCommand` (`cli/pipeline/detect-migration-changes.command.ts`) compares the `base..head` git range against `migrations_folder` (default `drizzle/`) via `decideMigrationsChanged`; an undiffable range (first push, manual dispatch, shallow-clone git failure) **fails safe to `migrations_changed = true`** so a needed migration is never skipped. For declared projects with changed migrations:

1. **Stage the rollout** on the target - env file synced, compose file rendered, registry login, image pull, `postgres` service up + healthy. On a fresh VPS the wal-g image entrypoint restores the latest base backup + replays archived WAL before the healthcheck passes, so migrate runs on the rehydrated schema.
2. **Run the migrate command** in an ephemeral container joined to the project's docker network (`target.runMigrate()`). Default command: `pnpm drizzle-kit migrate` (`DEFAULT_MIGRATE_COMMAND` in `domain/deploy/target.ts`). Override per project via `migrate_command`.

**No pre-migrate snapshot is taken** (`migrate-remote.command.ts`): continuous WAL archiving (`archive_command`, RPO ≤180s) plus the periodic base backups already capture the pre-migration state for a wal-g point-in-time recovery. A migration failure leaves both backup systems intact.

### Why migrations don't run from the app entrypoint

Two replicas rotating during a redeploy would both try to acquire the schema; if one beats the other, the slower one starts against a half-migrated schema. The advisory-lock approach (`pg_advisory_lock`) only serializes; it does NOT roll back. The `migrate-remote` job runs once, gated, with a snapshot.

### Quality-matrix integration

When `[services.postgres]` is declared, the quality matrix adds a `drizzle-check` task (`check_command`, default `pnpm drizzle-kit check`) that runs on the GH runner during the quality stage. Pure filesystem check, no DB - validates the local migrations folder before any deploy artifact is produced.

## Backups (dual pg_dump + wal-g)

Two independent prod-only systems run in parallel; both are essential (pg_dump = portable cross-version schema recovery, wal-g = PITR granularity + continuous protection):

| System | Cadence | Bucket | Retention |
|--------|---------|--------|-----------|
| **pg_dump** (`postgres-backup` sidecar) | `@daily` logical dump | `<project>-backups-dump` | GFS (7 daily / 4 weekly / 3 monthly), cron-pruned |
| **wal-g** (server `archive_command` + `postgres-walg` loop) | continuous WAL (RPO ≤180s) + daily base backup | `<project>-backups` (`basebackups_005/` + `wal_005/`) | `7` FULL base backups (`wal-g delete retain FULL`); old WAL pruned once a new base anchors the chain |

### pg_dump objects + retention

The pg_dump sidecar writes objects keyed `<project_id>_<YYYY-MM-DDTHH:MM:SS>.dump` (the upstream image's own format: timestamp = `date +%Y-%m-%dT%H:%M:%S` - colons, no `Z`, no millis) under `<project>-backups-dump` - the parser regex mirrors it exactly.

### GFS retention - `selectPostgresBackupsToPrune`

Pure function. Inputs: a list of parsed snapshots. Output: the subset to delete.

- Keep the newest snapshot in each of the **7 most-recent UTC days** (daily bucket)
- Keep the newest snapshot in each of the **4 most-recent ISO weeks** (Monday-aligned)
- Keep the newest snapshot in each of the **3 most-recent UTC months**

Buckets overlap on the newest snapshot, so the worst-case upper bound is 7 + 4 + 3 = 14. With dense daily data the realized count is typically lower because the most-recent weekly and the two most-recent monthly buckets overlap the 7-day window. Constants: `POSTGRES_BACKUP_RETENTION_DAILY`, `_WEEKLY`, `_MONTHLY`.

`parsePostgresBackupKey` round-trips through `new Date(iso)` and rejects keys that don't survive the round trip (Feb 30, Apr 31, etc.) - so a malformed or hand-crafted key cannot be classified into a bucket it doesn't belong to and displace a real snapshot.

### Pruning (cron via the same sidecar)

Pruning runs as part of the same backup flow - listing the existing keys via the R2 backup-store adapter, computing the prune set, deleting via the S3 SDK. Only the pg_dump bucket is GFS-pruned; wal-g manages its own retention via the FULL-backup count.

### Auto-restore on a fresh VPS

When the `postgres` service starts on an **empty** `postgres-data` volume, the wal-g image entrypoint downloads the latest base backup, extracts it into `PGDATA`, and replays archived WAL up to the newest segment before the healthcheck passes - transparent, no operator action. Combined with the **final backup before teardown** (see Teardown), a planned teardown + redeploy is a **zero-loss VPS swap**; an unplanned (dead VPS) teardown loses at most the ~180s archive_timeout window.

### Staleness alerts

`domain/monitoring/alert-rules-service.ts`: `BackupStale` (pg_dump, critical at >50h = two missed daily cycles), `WalgBaseBackupStale` (warning in `[26h, 50h)` = one missed cycle, WAL still archiving), `WalgBaseBackupMissing` (critical at >50h). A failure in one system never affects the other; the wal-g loop retries on failure with exponential backoff.

## Restore (standalone `restore` command - pg_dump logical restore)

Destructive: `pg_restore --clean` drops + recreates the target objects before restoring from a **pg_dump logical backup**. This is NOT wal-g point-in-time recovery (PITR replays continuously on a fresh VPS via the entrypoint); `restore` replays the closest daily dump picked by timestamp. Argv shape:

```
infrastructure restore --project <slug> --at <iso-date> --yes
```

- `--project` selects which project's pg_dump bucket (`<project>-backups-dump`) to read from.
- `--at` is an ISO date/time; `selectPostgresBackupForRestore` picks the latest snapshot whose timestamp is **<= --at** (inclusive boundary). Date-only strings resolve to midnight UTC.
- `--yes` is the destructive-confirmation gate (`ensurePostgresRestoreConfirmed` throws without it).

Unknown flags are rejected (`node:util parseArgs` strict mode) so a typo like `--yess` cannot defeat the gate.

The runner (`adapters/postgres/restore-runner.ts`) feeds the password to libpq via `PGPASSWORD` (not argv) so it stops appearing in `ps aux` / `/proc/<pid>/cmdline`. `redactPostgresPassword` is the pure helper that splits the URL.

## Teardown

`teardown` on a postgres-using project:

1. **Captures a final wal-g base backup before any destruction** (`maybeCaptureFinalBackup`), unless `--wipe-backups` (env `TEARDOWN_WIPE_BACKUPS`) or `TEARDOWN_SKIP_FINAL_BACKUP=1`. The next provision auto-restores it, so a planned teardown + redeploy loses ZERO data. **A capture failure ABORTS the teardown** rather than destroy data it could not back up (override with `TEARDOWN_SKIP_FINAL_BACKUP=1` if the VPS is already unreachable and you accept losing the last ~180s).
2. Stops + removes every declared user service (`<name>`), `postgres`, `postgres-walg`, `postgres-backup`
3. **Preserves the `postgres-data` named volume by default** (state survives) - pass `--wipe-backups` to drop it along with the R2 backup objects via `wipePostgresBackups`
4. Removes **both** per-project backup buckets only when `--wipe-backups` is set: `<project>-backups` (wal-g) + `<project>-backups-dump` (pg_dump). Wiping one alone would strand backups in the other.

`teardown-guard` validates this is safe before destruction.

## Rules

1. **Migrations run from CI, never from the app** - the `migrate-remote` job is the only sanctioned migration path. App entrypoints that run `drizzle-kit migrate` on startup are a bug.
2. **One blessed postgres version** - bump `NEXTNODE_POSTGRES_VERSION` to roll a new major across embedded deploys. Never override per project.
3. **Postgres is internal-only** - the sidecar must not bind a host port. The app reaches it via the docker compose service name on the internal network.
4. **Identifiers are derived, never typed** - `postgresProjectIdentifier`, `postgresBackupBucketName`, `buildPostgresEmbeddedDatabaseUrl` are the only sources of truth.
5. **The user/DB names live on the public channel; the password and `DATABASE_URL` live on the secret channel** - `mergeServiceEnvs` enforces the partition, but the design is "credentials in the secret half".
6. **Migrate gates on changed migration files** - the `detect-migration-changes` job emits `migrations_changed`; an undiffable range fails safe to `true`. No pre-migrate snapshot is taken - continuous WAL archiving + base backups cover the pre-migration state.
7. **Two independent backup systems** - pg_dump (daily logical, GFS-retained, `<project>-backups-dump`) and wal-g (continuous WAL + daily base backups, `<project>-backups`). Both essential; a failure in one never affects the other.
8. **Volumes are preserved on teardown by default** - lost postgres data on a redeploy or accidental teardown would be a catastrophic NextNode-side bug. `--wipe-backups` is opt-in and irreversible (purges BOTH buckets).
9. **A planned teardown captures a final backup for a zero-loss redeploy** - the next VPS auto-restores it before migrate runs. A capture failure aborts the teardown.
