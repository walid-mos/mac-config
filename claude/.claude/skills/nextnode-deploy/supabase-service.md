# Supabase Service Abstraction

Self-hosted Supabase stack (postgres + auth + storage + realtime + kong + studio), modeled as a backing service. Declared per-project as an empty `[services.supabase]` table in `nextnode.toml`. Source: `src/cli/services/supabase/`, `src/domain/services/supabase.ts`, `src/domain/services/supabase-jwt.ts`, `src/domain/services/postgres-exporter.ts`, `src/domain/caddy/supabase.ts`.

## Config

```toml
[project]
domain = "myapp.example.com"  # REQUIRED when [services.supabase] is declared

[services.supabase]
# (empty - declarative gate, no fields today)
```

Validation: `config/validation/services/supabase.ts` only checks that the section parses as a TOML table. Every per-deploy knob lives in the GitHub secrets layer or as a module-level constant in `domain/services/supabase.ts`.

`[services.supabase]` does NOT mix with `[services.postgres]` — Supabase ships its own pinned Postgres 17 image. Use one or the other.

## Pinned versions (fleet-wide)

`domain/services/supabase.ts` holds the entire image set as module constants — bumping one rolls a new version across every Supabase-using project on the next pipeline run.

| Constant | Image |
|----------|-------|
| `SUPABASE_POSTGRES_IMAGE` | `supabase/postgres:17.6.1.130` |
| `SUPABASE_AUTH_IMAGE` | `supabase/gotrue:v2.186.0` |
| `SUPABASE_REALTIME_IMAGE` | `supabase/realtime:v2.76.5` |
| `SUPABASE_STORAGE_IMAGE` | `supabase/storage-api:v1.48.26` |
| `SUPABASE_KONG_IMAGE` | `kong/kong:3.9.1` |
| `SUPABASE_STUDIO_IMAGE` | `supabase/studio:2026.04.27-sha-5f60601` |
| `SUPABASE_BACKUP_IMAGE` | `postgres:17-alpine` (sidecar — `pg_dump` from same PG 17 family) |

The upstream supabase/supabase template still defaults to PG 15; NextNode opts the fleet into PG 17 across all projects.

## Compose topology

`buildSupabaseStack()` returns the stack; `buildSupabaseBackupSidecar(project, env)` returns the backup container; `postgres-exporter` is layered on for monitoring. All services join the project compose network; only Caddy (host-side, see below) exposes ports publicly.

| Service | Image | Public reach | Purpose |
|---------|-------|--------------|---------|
| `db` | `SUPABASE_POSTGRES_IMAGE` | internal only | Postgres cluster + initdb-bootstrapped auth/storage/realtime schemas. Named volume `supabase-db-data` mounted at `/var/lib/postgresql/data` |
| `auth` | `SUPABASE_AUTH_IMAGE` | via kong | gotrue (magic-link / OAuth) |
| `realtime` | `SUPABASE_REALTIME_IMAGE` | via kong | WebSockets |
| `storage` | `SUPABASE_STORAGE_IMAGE` | via kong | S3-compatible object storage layer |
| `kong` | `SUPABASE_KONG_IMAGE` | Caddy → `kong:8000` | API gateway. `SUPABASE_KONG_HTTP_PORT = 8000` |
| `studio` | `SUPABASE_STUDIO_IMAGE` | Caddy → `studio:3000` (basic auth) | Admin UI. `SUPABASE_STUDIO_HTTP_PORT = 3000` |
| `supabase-backup` | `SUPABASE_BACKUP_IMAGE` | internal only | `while true; pg_dump | gzip | aws s3 cp; sleep 86400` |
| `postgres-exporter` | `prometheuscommunity/postgres-exporter` | Tailscale only | `pg_stat_statements` scrape target for monitoring VM |

Compose service names match the upstream supabase/supabase docker-compose template so operator runbooks (`docker compose logs db`, `docker compose exec auth ...`) transfer untouched.

## Caddy routing (`domain/caddy/supabase.ts`)

When `[services.supabase]` is declared, `composeCaddyConfig` splices three vhosts under the project's `deployDomain`:

| Vhost | Target | Auth |
|-------|--------|------|
| `<domain>` | the user `app` container | none (or whatever the app sets) |
| `api.<domain>` (`supabaseApiHostname`) | `kong:8000` | none — kong + JWT enforce |
| `studio.<domain>` (`supabaseStudioHostname`) | `studio:3000` | Caddy `http_basic` (`SUPABASE_DASHBOARD_USERNAME` / `{env.DASHBOARD_PASSWORD}`) |

Studio basic auth reads `DASHBOARD_PASSWORD` from the systemd EnvironmentFile rendered by `renderCaddyEnv` — Caddy is not a compose service, so its env contract is independent from the supabase stack's `.env`.

## R2 `backups` alias (auto-injection)

`computeR2ServiceAliases` (called when `[services.supabase]` is declared) appends the literal alias `backups` to the project's `[services.r2] buckets` list — operators do not need to add it manually. Bucket physical name is `<project>-<env>-backups`, provisioned via the standard `ensureR2Bucket` flow at `provision`.

`buildSupabaseBackupEnv(r2State)` projects the loaded R2 service state down to the four env vars the backup sidecar reads:

```typescript
{
  BACKUP_R2_ACCESS_KEY_ID,
  BACKUP_R2_SECRET_ACCESS_KEY,
  BACKUP_R2_ENDPOINT,
  BACKUP_R2_BUCKET,
}
```

Missing `backups` alias in `r2State.buckets` → fail loud (state file is corrupt, re-run `provision`).

Backup object key format:

```
s3://<project>-<env>-backups/pg_dump_<project>_<env>_<YYYYMMDDTHHMMSSZ>.sql.gz
```

The monitoring tracker parses project + env directly from the key without listing-time lookups. Loop cadence is `SUPABASE_BACKUP_INTERVAL_SECONDS = 86_400` (daily). Errors (transient R2 outage, db blip) log to stderr; the loop survives and retries the next day.

## Secrets — env-secrets (per-env GitHub secrets)

All Supabase project credentials are GitHub **env-secrets**, never org-secrets. `EnvSecretsAdapter` (`adapters/github/env-secrets.ts`) wraps `gh secret set <NAME> --repo <owner>/<repo> --env <environment>`.

| Secret | Source | Idempotency contract |
|--------|--------|----------------------|
| `POSTGRES_PASSWORD` | auto-generated (`randomBytes(32).toString('base64')`) by `provision` | **never rotated by provision** — would split-brain the initdb-baked role |
| `JWT_SECRET` | auto-generated by `provision` | **never rotated by provision** — rotating invalidates every signed `ANON_KEY` / `SERVICE_ROLE_KEY` already in client caches |
| `PG_EXPORTER_PASSWORD` | auto-generated by `provision` | **never rotated by provision** — would split-brain the SQL role baked at initdb time. Force-rotate via the `rotate-pg-exporter-password` standalone CLI command |
| `DASHBOARD_PASSWORD` | **operator-set** before first `provision` (`requireDashboardPasswordSecret`) | provision fails loud if missing — this is the human admin login for Studio behind basic auth, auto-generating would lock the operator out (env-secrets are write-only) |

Idempotency is checked via `repoSecrets[name]` (the in-process `ALL_SECRETS` dict the deploy reads), not via a separate `gh secret list` call — single source of truth, no drift between "does it exist?" and "what value will deploy actually see?".

The `PG_EXPORTER_PASSWORD` flip from org-secret to env-secret (commit `7dcede5`) is the canonical reference for choosing the right adapter.

## Derived keys — `ANON_KEY` / `SERVICE_ROLE_KEY`

Signed deterministically at deploy time by `signSupabaseJwt` (HS256, `domain/services/supabase-jwt.ts`) from `JWT_SECRET`:

```typescript
secret.ANON_KEY = signSupabaseJwt(
  { role: 'anon', iss: 'supabase', iat: SUPABASE_DERIVED_KEY_IAT },
  jwtSecret,
)
secret.SERVICE_ROLE_KEY = signSupabaseJwt(
  { role: 'service_role', iss: 'supabase', iat: SUPABASE_DERIVED_KEY_IAT },
  jwtSecret,
)
```

`SUPABASE_DERIVED_KEY_IAT = 0` (pinned epoch, NOT `Date.now()`) — same `JWT_SECRET` → same tokens across every redeploy, so clients caching the key see zero spurious churn. `SUPABASE_JWT_EXPIRY_SECONDS = 3600` mirrors the upstream default.

The keys never leave the deploy host: they're computed inside `loadEnv()` from `JWT_SECRET` and written into the compose `.env`. They are NOT stored as GitHub secrets — the secret is `JWT_SECRET`, the keys are pure functions of it.

## Runtime contract (`createSupabaseService(ctx).loadEnv()`)

Returns `{public, secret}` merged into the compose `.env` by `mergeServiceEnvs`:

```typescript
secret: {
  POSTGRES_PASSWORD,         // from repoSecrets
  JWT_SECRET,                // from repoSecrets
  PG_EXPORTER_PASSWORD,      // from repoSecrets
  DASHBOARD_PASSWORD,        // from repoSecrets
  ANON_KEY,                  // signed in-process
  SERVICE_ROLE_KEY,          // signed in-process
  BACKUP_R2_ACCESS_KEY_ID,   // from R2 service state
  BACKUP_R2_SECRET_ACCESS_KEY,
  BACKUP_R2_ENDPOINT,
  BACKUP_R2_BUCKET,
}
public: {
  KONG_HTTP_PORT: '8000',
  JWT_EXPIRY: '3600',
  DASHBOARD_USERNAME: 'supabase',
  STUDIO_DEFAULT_ORGANIZATION: <projectName>,
  STUDIO_DEFAULT_PROJECT: <projectName>,
  POOLER_TENANT_ID: <projectName>,
  API_EXTERNAL_URL: 'https://api.<deployDomain>',
  SITE_URL: 'https://<deployDomain>',
}
```

`deployDomain === null` → fail loud (`project.domain must be set` — supabase bakes the resolved domain into gotrue's `API_EXTERNAL_URL` (magic-link / OAuth callback host) and `SITE_URL` (default redirect target), so a missing domain breaks the entire auth flow at runtime).

`ctx.infraStorage === null` → fail loud (factory throws — R2 service state load is required to derive `BACKUP_R2_*`).

## App-side contract

The user app:

- Reads `ANON_KEY`, `SERVICE_ROLE_KEY`, `API_EXTERNAL_URL`, `SITE_URL` from env. Never derives them in app code.
- Never imports `JWT_SECRET` directly — only gotrue/realtime/storage running inside the compose stack do.
- Points the supabase-js client at `https://api.<domain>`, not `https://<domain>` (kong gateway is the single API entrypoint).

## postgres-exporter sidecar (monitoring)

`buildPostgresExporterSidecar()` adds a `postgres-exporter` service that scrapes `pg_stat_statements` (top `POSTGRES_EXPORTER_TOP_QUERIES_LIMIT = 50` queries) and exposes `:9187` to the Tailscale interface only. The central monitoring VM filters scrape targets by the `client-vps` Tailscale tag (`domain/monitoring/client-vps-relabel.ts`).

Required scaffolding at the project compose root:

- `00-pg-monitor.sql` (`POSTGRES_EXPORTER_INIT_FILENAME`) bootstrapped into `/docker-entrypoint-initdb.d/` to create the `postgres_exporter` SQL role with `PG_EXPORTER_PASSWORD`.
- `pg-exporter-queries.yaml` (`renderPostgresExporterQueriesYaml`) mounted at `PG_EXPORTER_EXTEND_QUERY_PATH` for the custom query set.

## Rotation (`rotate-pg-exporter-password` standalone command)

```
infrastructure rotate-pg-exporter-password
```

The escape hatch for `PG_EXPORTER_PASSWORD`. Idempotent `provision` never rotates (would desync the initdb-baked SQL role and the stored secret). Operator runbook:

1. `ALTER ROLE postgres_exporter PASSWORD '<new>'` on the live db (manually, via `psql` from the VPS)
2. Run `rotate-pg-exporter-password` — generates a new 32-byte base64 value, pushes it as the env-secret
3. Re-trigger the deploy workflow so the refreshed `ALL_SECRETS` reaches compose `.env`

The same pattern would apply for any future "needs DB-side coordination" rotation — never auto-rotate in `provision`.

## Provisioning (`provision` command)

`createSupabaseService(ctx).provision()`:

1. `ensurePgExporterPasswordSecret` — skip if `repoSecrets['PG_EXPORTER_PASSWORD']` already set; else generate + push as env-secret
2. `ensurePostgresPasswordSecret` — same idempotency contract for `POSTGRES_PASSWORD`
3. `ensureJwtSecret` — same for `JWT_SECRET`
4. `requireDashboardPasswordSecret` — verify-only; throw if missing (operator must set it themselves)

R2 bucket creation rides on the standard R2 service factory (`createR2Service`) since the `backups` alias is part of the project's R2 service state.

## Teardown

Same shape as other compose-stack services:

1. Stops + removes `app`, `db`, `auth`, `realtime`, `storage`, `kong`, `studio`, `supabase-backup`, `postgres-exporter`
2. **Preserves `supabase-db-data` named volume by default** — destroying it would lose the entire customer database. Pass `wipeBackups` to drop the volume AND wipe the R2 backup objects
3. R2 `backups` bucket is dropped only when `wipeBackups` is set

`teardown-guard` validates this is safe before destruction.

## Rules

1. **`[services.supabase]` is mutually exclusive with `[services.postgres]`** — Supabase ships its own pinned Postgres. Two postgres stacks on one VPS is not the intended pattern.
2. **`project.domain` is REQUIRED when supabase is declared** — `API_EXTERNAL_URL` and `SITE_URL` are baked from it. Missing domain throws at deploy time.
3. **All Supabase credentials are GitHub env-secrets** — per-project + per-environment. Never org-secrets. See `EnvSecretsAdapter` (`adapters/github/env-secrets.ts`).
4. **Provision is idempotent and never rotates secrets** — `JWT_SECRET`, `POSTGRES_PASSWORD`, `PG_EXPORTER_PASSWORD` are skip-on-present. Rotations are dedicated standalone CLI commands.
5. **`DASHBOARD_PASSWORD` is operator-set, never auto-generated** — GitHub env-secrets are write-only; auto-generating would lock the operator out of Studio. `requireDashboardPasswordSecret` enforces this with a loud failure.
6. **`ANON_KEY` / `SERVICE_ROLE_KEY` are derived, never stored** — signed in-process from `JWT_SECRET` at deploy time with `SUPABASE_DERIVED_KEY_IAT = 0` so they stay stable across redeploys. Don't add them to the GitHub secrets list.
7. **Backup `backups` R2 alias is auto-injected** — `computeR2ServiceAliases` appends it whenever supabase is declared. Operators must not also declare it manually in `[services.r2]` (idempotency-checked, but the convention is "don't").
8. **Studio is fronted by Caddy basic auth on `studio.<domain>`** — never expose the studio container's `:3000` to the public internet directly. The `http_basic` route is the only sanctioned entrypoint.
9. **kong is the only external API entrypoint** — apps must hit `https://api.<domain>` (kong), never the auth/storage/realtime services directly. The compose network is internal-only.
10. **Versions are fleet-wide pins** — bump the image constants in `domain/services/supabase.ts` to roll a new version across every Supabase project. Never override per project.
