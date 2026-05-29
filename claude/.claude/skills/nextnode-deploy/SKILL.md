---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure).
  Config-driven CI/CD CLI: parses nextnode.toml, runs quality gates, deploys
  to Cloudflare Pages or Hetzner VPS, manages golden images, R2 storage,
  teardown, SEO guard, prod gate, DeployTarget abstraction. Load when working
  in a repo containing nextnode.toml, when @nextnode-solutions/infrastructure
  appears in package.json, or when the user mentions NextNode deploys.
user-invocable: true
synced-at: f2d391e
---

# @nextnode-solutions/infrastructure

Config-driven CI/CD CLI for NextNode projects. Reads `nextnode.toml`, runs quality gates, deploys to Cloudflare Pages or Hetzner VPS, parses publish results, and enforces prod gates.

**Source**: `packages/infrastructure` in `@nextnode/core`
**Binary**: runs via `node src/index.ts <command>` (Node 24 native TS)

## Instructions

Always read the actual code before answering - start with `packages/infrastructure/src/` and `packages/infrastructure/CLAUDE.md`.

## CLI commands

| Command | Type | What it does |
|---------|------|-------------|
| `plan` | config | Parse `nextnode.toml`, output quality matrix + plan outputs |
| `teardown-guard` | config | Validate teardown preconditions before destruction |
| `provision` | deploy | Provision infra (Pages project + domains, or Hetzner VPS + R2 services) |
| `deploy` | deploy | Merge target/services/secrets envs, sync to target, deploy app |
| `dns` | deploy | Reconcile Cloudflare DNS records (A for VPS, CNAME for Pages) |
| `teardown` | deploy | Tear down provisioned infra (VPS + DNS, or Pages project + domains + R2). Volumes are preserved by default; pass `wipeBackups` to drop them |
| `migrate-remote` | deploy | Stage rollout + take pre-migrate R2 snapshot + run `migrate_command` in an ephemeral container on the network. Runs between `provision` and `deploy` for projects with `[services.postgres]`. No-op when postgres is not declared |
| `seo-guard` | deploy | Inject `_headers` + `robots.txt` into build output for non-prod envs |
| `prod-gate` | standalone | Verify dev pipeline passed before production deploy |
| `publish-result` | standalone | Parse semantic-release output, write status/version/summary |
| `compute-image-ref` | standalone | Normalize `GITHUB_REPOSITORY` + `GITHUB_SHA` into a GHCR image ref |
| `build-golden-image` | standalone | Build + snapshot a Hetzner golden image (Docker preinstalled), keyed by deterministic fingerprint, prunes old snapshots. Replaces Packer. See [golden-image.md](golden-image.md) |
| `recover` | standalone | Recover/rebuild VPS state from Hetzner labels when local state is lost |
| `restore` | standalone | Restore a postgres backup from R2 by timestamp (most-recent dump <= `--at`). Destructive (`pg_restore --clean`) - requires explicit `--yes`. See [postgres-service.md](postgres-service.md) |
| `rotate-pg-exporter-password` | standalone | Force-rotate `PG_EXPORTER_PASSWORD` GitHub env-secret with a fresh 32-byte base64 value. Operator runbook: `ALTER ROLE postgres_exporter PASSWORD '<new>'` on the live db first, then re-trigger deploy so the refreshed `ALL_SECRETS` reaches compose `.env`. See [supabase-service.md](supabase-service.md) |

Commands are registered in `index.ts` in three maps: `PLAN_COMMANDS`, `DEPLOY_COMMANDS`, `STANDALONE_COMMANDS`. Deploy commands receive a `DeployableConfig` and are skipped (logged "non-deployable project") for `type=package`.

## Folder structure

See [structure.md](structure.md) for the full annotated tree of `src/cli/`, `src/domain/`, `src/adapters/`, and `src/config/`. The strict layer import rules (domain pure, adapters never decide, CLI orchestrates) live in `packages/infrastructure/CLAUDE.md`.

## Config: nextnode.toml

See [config.md](config.md) for full schema, types, and env var reference.

## DeployTarget interface

Provider-agnostic abstraction. See [deploy-env.md](deploy-env.md) and `src/domain/deploy/target.ts` for the full TS interface, env contract, and orchestration rules.

Implemented targets: `CloudflarePagesTarget` (static sites) and `HetznerVpsTarget` (containerized apps). Multi-service compose is not supported yet (single `app` service hardcoded).

See [hetzner-vps.md](hetzner-vps.md) for the Hetzner VPS architecture deep-dive.

## Backing services

Pluggable per-service abstraction in `domain/services/`. Each service contributes a `{public, secret}` env block, just like a `DeployTarget` - they merge through the same primitive (`mergeServiceEnvs`) with collision detection. Registered services live in `SERVICE_NAMES` (`config/types.ts`) and force every service-aware site (validators, env merger, future routers) to handle them via mapped types.

Currently registered:

- **R2** (Cloudflare object storage). Declared per-project in `[services.r2] buckets = [...]`. See [r2-service.md](r2-service.md).
- **Postgres**. Declared per-project in `[services.postgres] mode = "embedded" | "external"`. Embedded mode provisions a sidecar container + daily R2 backup sidecar with GFS retention (7d/4w/3m). External mode reads `DATABASE_URL` from repo secrets. See [postgres-service.md](postgres-service.md).
- **Supabase** (self-hosted stack: postgres + auth + storage + realtime + kong + studio). Declared per-project as an empty `[services.supabase]` table. Auto-injects the `backups` R2 alias, provisions per-env GitHub secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `PG_EXPORTER_PASSWORD` auto-generated; `DASHBOARD_PASSWORD` operator-set), derives `ANON_KEY` / `SERVICE_ROLE_KEY` deterministically from `JWT_SECRET` (HS256), fronts kong + studio via Caddy on `api.<domain>` / `studio.<domain>`. See [supabase-service.md](supabase-service.md).

## SEO guard

Prevents search engine indexing of non-production deploys. Runs after `pnpm build`, before Cloudflare Pages deploy.

- **Domain**: `computeSeoGuardFiles(environment)` - returns `_headers` (X-Robots-Tag: noindex) + `robots.txt` (Disallow: /) for non-prod, empty array for prod
- **Adapter**: `injectFiles(buildDirectory, files)` - writes files to build output
- **CLI**: `seoGuardCommand` - orchestrates domain + adapter, reads `BUILD_DIRECTORY` env var

## Prod gate

Configurable dev workflow path via `DEV_WORKFLOW_FILE` env var (default: `deploy-dev.yml`). Multi-app repos pass their custom filename (e.g. `landing-dev.yml`) through the workflow input `dev_workflow_file`.

See [pipeline.md](pipeline.md) for full pipeline architecture.

## Deploy env strategy

See [deploy-env.md](deploy-env.md) for SITE_URL computation and secrets flow.

## Kickstarting a new package

See [kickstart-package.md](kickstart-package.md) for the complete guide.

## Hetzner caller convention

See [hetzner-caller.md](hetzner-caller.md) for what a project repo must provide (minimal `docker-compose.yml`, `Dockerfile`, forbidden keys, caller workflow files).

## Rules

1. **Check the code, not assumptions** - only reference features that exist in source
2. **`resolveDeployDomain` is the single source of truth** for dev subdomain convention - never inline `dev.{domain}`
3. **SITE_URL is always auto-computed** - every DeployTarget MUST put SITE_URL in `contributeEnv().public`. The orchestrator narrows the merged env via `buildDeployEnv()` and throws if it's missing
4. **Single source of truth for all defaults** - every config default lives in `config/types.ts` as a named constant. Validators import these constants - they never define their own inline defaults. If a concept doesn't apply to a project type, there must be NO default for it
5. **DeployTarget hides provider details** - no SSH/Docker/hcloud/Caddy in public types. Adding a new provider = new adapter, zero CLI change
6. **Backing services compose like targets** - every service contributes a `{public, secret}` `ServiceEnv`; targets and services merge through `mergeServiceEnvs`. Two services claiming the same env key throws (collision = bug, not silent overwrite)
7. **Strict layer rules apply** - domain is 100% pure (no IO/env/logger), adapters never make business decisions, CLI orchestrates. See `packages/infrastructure/CLAUDE.md` for the full enforcement table.
8. **Postgres migrations run from CI, not from the app** - migrations execute in the `migrate-remote` job between `provision` and `deploy` via an ephemeral container on the project network, after a pre-migrate R2 snapshot. App entrypoints MUST NOT run migrations on startup (race conditions across rotating replicas, no rollback safety net). The `migrate_command` defaults to `pnpm drizzle-kit migrate` - override only for non-Drizzle stacks.
9. **A postgres NextNode version is a fleet-wide pin** - `NEXTNODE_POSTGRES_VERSION` (`domain/services/postgres.ts`) is the single source of truth for the server image AND the backup sidecar image. Clients do not pick their version - NextNode bumps the constant to roll out a new major across every embedded deploy. `mode = "external"` users own their version.
10. **Project secrets are GitHub env-secrets, never org-secrets** - any credential scoped to one project goes through `EnvSecretsAdapter` (`adapters/github/env-secrets.ts`) which calls `gh secret set <NAME> --repo <owner>/<repo> --env <environment>`. `OrgSecretsAdapter` is reserved for cross-project credentials shared across the entire `NextNodeSolutions` org (Cloudflare API tokens, Hetzner API tokens). Heuristic: per-project credential → env-secret; cross-project credential → org-secret. The `PG_EXPORTER_PASSWORD` flip from org-secret to env-secret (commit `7dcede5`) is the canonical reference for this distinction.
11. **Idempotent provision skips on present; rotate is an explicit command** - service `provision()` reads `repoSecrets[name]` and **never overwrites** an existing value (auto-generating a fresh `JWT_SECRET` on every run would invalidate every issued token; rotating `POSTGRES_PASSWORD` would split-brain the initdb-baked role). Rotations are dedicated standalone CLI commands (e.g. `rotate-pg-exporter-password`) with operator runbook steps documented inline.
