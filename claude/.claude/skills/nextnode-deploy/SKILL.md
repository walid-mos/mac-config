---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure).
  Config-driven CI/CD CLI for Cloudflare Pages and Hetzner VPS deploys. Load
  when a repo has nextnode.toml, @nextnode-solutions/infrastructure in
  package.json, or the user mentions NextNode deploys.
user-invocable: true
synced-at: 0d67405
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
| `provision` | deploy | Provision infra (Pages project + domains, or Hetzner VPS + R2 + CDN domains), then bootstrap auto-generated `[deploy].secrets` via `ensureGeneratedSecrets` |
| `deploy` | deploy | Merge target/services/secrets envs, sync to target, deploy app |
| `dns` | deploy | Reconcile Cloudflare DNS records (A for VPS, CNAME for Pages) |
| `teardown` | deploy | Tear down provisioned infra; volumes preserved unless `wipeBackups`. See [multi-service.md](multi-service.md) teardown |
| `migrate-remote` | deploy | Pre-migrate R2 snapshot + `migrate_command` in an ephemeral container, between `provision` and `deploy`. No-op without `[services.postgres]`. See [postgres-service.md](postgres-service.md) |
| `seo-guard` | deploy | Inject `_headers` + `robots.txt` into build output for non-prod envs |
| `prod-gate` | standalone | Verify dev pipeline passed before production deploy |
| `publish-result` | standalone | Parse semantic-release output, write status/version/summary |
| `compute-image-ref` | standalone | Resolve the per-service `image_refs` JSON Record, render `docker-bake.json` from `nextnode.toml`, emit `bake_file`. See [pipeline.md](pipeline.md) |
| `build-golden-image` | standalone | Build + snapshot a Hetzner golden image (Docker preinstalled), keyed by deterministic fingerprint, prunes old snapshots. Replaces Packer. See [golden-image.md](golden-image.md) |
| `recover` | standalone | Recover/rebuild VPS state from Hetzner labels when local state is lost |
| `restore` | standalone | Restore a postgres backup from R2 by timestamp. Destructive (`pg_restore --clean`) - requires explicit `--yes`. See [postgres-service.md](postgres-service.md) |
| `rotate-pg-exporter-password` | standalone | Force-rotate the `PG_EXPORTER_PASSWORD` env-secret. Runbook in [supabase-service.md](supabase-service.md) |

Commands are registered in `index.ts` in three maps: `PLAN_COMMANDS`, `DEPLOY_COMMANDS`, `STANDALONE_COMMANDS`. Deploy commands receive a `DeployableConfig` and are skipped (logged "non-deployable project") for `type=package`.

## Folder structure

See [structure.md](structure.md) for the full annotated tree of `src/cli/`, `src/domain/`, `src/adapters/`, `src/config/`, and `src/kernel/` (kernel rationale: structure.md rule 5). The strict layer import rules live in `packages/infrastructure/CLAUDE.md`.

## Config: nextnode.toml

See [config.md](config.md) for full schema, types, and env var reference.

## DeployTarget interface

Provider-agnostic abstraction. See [deploy-env.md](deploy-env.md) and `src/domain/deploy/target.ts` for the full TS interface, env contract, and orchestration rules.

Implemented targets: `CloudflarePagesTarget` (static sites) and `HetznerVpsTarget` (containerized apps). Workloads are declared per project under `[deploy.services.<name>]` — N services per project, everything keyed off the declared name. Per-service routing/env/image/teardown invariants live in [multi-service.md](multi-service.md); the Hetzner VPS architecture deep-dive in [hetzner-vps.md](hetzner-vps.md).

## Backing services

Pluggable per-service abstraction in `domain/services/`. Each service contributes a `{public, secret}` env block, just like a `DeployTarget` - they merge through the same primitive (`mergeServiceEnvs`) with collision detection. Registered services live in `SERVICE_NAMES` (`config/types.ts`) and force every service-aware site (validators, env merger, future routers) to handle them via mapped types.

Currently registered:

- **R2** (Cloudflare object storage). Declared as a table-array of `{ name, cdn }` buckets under `[[services.r2.buckets]]`; `cdn = true` attaches a public custom domain + `R2_BUCKET_<ALIAS>_URL`. See [r2-service.md](r2-service.md).
- **Postgres**. Declared in `[services.postgres] mode = "embedded" | "external"` — embedded sidecar + daily R2 backups (GFS), or external `DATABASE_URL`. See [postgres-service.md](postgres-service.md).
- **Supabase**. Declared as an empty `[services.supabase]` table — full self-hosted stack (postgres + auth + storage + realtime + kong + studio) with auto-injected `backups` bucket and per-env secrets. See [supabase-service.md](supabase-service.md).

## SEO guard

Prevents search engine indexing of non-production deploys. Runs after `pnpm build`, before Cloudflare Pages deploy.

- **Domain**: `computeSeoGuardFiles(environment)` - returns `_headers` (X-Robots-Tag: noindex) + `robots.txt` (Disallow: /) for non-prod, empty array for prod
- **Adapter**: `injectFiles(buildDirectory, files)` - writes files to build output
- **CLI**: `seoGuardCommand` - orchestrates domain + adapter, reads `BUILD_DIRECTORY` env var

## Prod gate

Configurable dev workflow path via `DEV_WORKFLOW_FILE` env var (default: `deploy-dev.yml`). Multi-app repos pass their custom filename (e.g. `landing-dev.yml`) through the workflow input `dev_workflow_file`.

See [pipeline.md](pipeline.md) for full pipeline architecture.

## Deploy env strategy

Two distinct "doors" carry config into a service; the dev declares only NAMES — values live in GitHub, never in `nextnode.toml`:

- **BUILD door** — values inlined into the image at build time via `build_args` (GitHub Variable NAMES; `SITE_URL` auto-injected). Secrets MUST NEVER be build args.
- **RUNTIME door** — values injected via compose `env_file`: per-service `secrets` (least privilege) + the GLOBAL `[deploy].secrets` pool (both targets).

See [deploy-env.md](deploy-env.md) for the full build-arg + secret-projection flow and SITE_URL computation.

## Kickstarting a new package

See [kickstart-package.md](kickstart-package.md) for the complete guide.

## Hetzner caller convention

See [hetzner-caller.md](hetzner-caller.md) for what a project repo must provide (`Dockerfile`, `nextnode.toml` build shape, infra-owned runtime concerns, caller workflow files).

## Rules

1. **Check the code, not assumptions** - only reference features that exist in source
2. **`resolveDeployDomain` is the single source of truth** for dev subdomain convention - never inline `dev.{domain}`. It's reused by `dns-records.ts`, `service-env.ts` and `service-upstreams.ts` so DNS, env, and Caddy all resolve the same hostname per service.
3. **`computeSiteUrl` is the single source for SITE_URL at BOTH build and runtime** — every target routes through it; the dev never declares SITE_URL anywhere. See [deploy-env.md](deploy-env.md).
4. **Single source of truth for all defaults** - every config default lives in `config/types.ts` as a named constant. Validators import these constants - they never define their own inline defaults. If a concept doesn't apply to a project type, there must be NO default for it
5. **DeployTarget hides provider details** - no SSH/Docker/hcloud/Caddy in public types. Adding a new provider = new adapter, zero CLI change
6. **Backing services compose like targets** - every service contributes a `{public, secret}` `ServiceEnv`; targets and services merge through `mergeServiceEnvs`. Two services claiming the same env key throws (collision = bug, not silent overwrite)
7. **Strict layer rules apply** - domain is 100% pure (no IO/env/logger), adapters never make business decisions, CLI orchestrates. See `packages/infrastructure/CLAUDE.md` for the full enforcement table.
8. **Postgres migrations run from CI, not from the app** — app entrypoints MUST NOT run migrations on startup. See [postgres-service.md](postgres-service.md) Migrations.
9. **A postgres NextNode version is a fleet-wide pin** — `NEXTNODE_POSTGRES_VERSION` covers server + backup sidecar; `mode = "external"` users own theirs. See [postgres-service.md](postgres-service.md).
10. **Project secrets are GitHub env-secrets, never org-secrets** — per-project credential → env-secret (`EnvSecretsAdapter`); cross-project credential → org-secret. Heuristic + canonical commit `7dcede5` in [supabase-service.md](supabase-service.md).
11. **Idempotent provision skips on present; rotate is an explicit command** — auto-rotation would invalidate live tokens / split-brain initdb-baked roles. See [supabase-service.md](supabase-service.md) rules 4–5.
12. **Service name is declared, never hardcoded; N services per project** — the `[deploy.services.<name>]` key flows end-to-end (GHCR suffix, `.env.<name>`, ports, bake target, DNS, Caddy, depends_on, migrate); any literal `"app"` is a bug. See [multi-service.md](multi-service.md).
13. **IMAGE_REFS is a JSON Record, not a bare ref** — plan emits `upstream_image_refs`, `compute-image-ref` emits `image_refs` + `bake_file`; a bare ref breaks `parseImageRefsEnv`. See [multi-service.md](multi-service.md) Image refs.
14. **/healthz is scoped to `build` services; depends_on gating adapts** — upstream images are pulled verbatim and never probed; dependents gate on `service_healthy` (build) vs `service_started` (upstream). See [multi-service.md](multi-service.md).
15. **Cross-phase compose identity** — phases 1 and 2 act on the same rendered compose file; backing-service blocks must be byte-identical across phases or phase 2 recreates the healthy DB. See [multi-service.md](multi-service.md).
16. **Config validation is valibot-based** — every schema lives in `src/config/validation/` as a valibot pipe (`abortEarly: false`, per-action user-facing messages); import field builders (`nonEmptyString`, `optionalNonEmpty`, `stringArray`, `optionalStringOrFalse`, `forbiddenField`) from `config/validation/valibot.ts`, never inline new schemas.
17. **All services share one `source`; mixing build and upstream is rejected** — a project genuinely needing both splits into two `nextnode.toml`s. See [multi-service.md](multi-service.md).
18. **Service `url` is unique and within `project.domain`** — one DNS record + one Caddy upstream + one host port per routed service; no `url` = internal-only. See [multi-service.md](multi-service.md).
19. **Cross-service URLs are injected symmetrically with `https://` in the value** — every `.env.<service>` contains every routed sibling's `<NAME>_URL`, consumed verbatim. See [deploy-env.md](deploy-env.md).
20. **Registry auth is homogeneous per deploy** — one token forwarded; upstream services must share one `registry_auth_secret` (or all omit it). See [multi-service.md](multi-service.md) Registry token.
21. **Postgres-owning service is explicit** — exactly one service declares `needs = ["postgres"]`; `selectMigrationService` throws on zero or many. See [multi-service.md](multi-service.md).
22. **Per-service teardown for DNS and Caddy; containers come down project-wide** — volumes preserved unless `wipeBackups`. See [multi-service.md](multi-service.md) teardown.
23. **Two doors for config — build args vs runtime secrets — and they never cross** — secrets MUST NEVER be build args (they bake into image layers / `docker history`); build-time secrets use `RUN --mount=type=secret`. See [deploy-env.md](deploy-env.md) Build args.
24. **Per-service secret projection is least-privilege by construction — no broadcast** — `buildServiceSecretEnv` routes USER secrets by own `secrets`, BACKING secrets by `needs` (provenance via `secretOrigins`); the DB/backup/migrate shared `.env` gets BACKING secrets only. See [deploy-env.md](deploy-env.md).
25. **`[deploy].secrets` is the GLOBAL secret pool — injected into every service (both targets)** — folded into each service via `expandServiceSecrets`; this REVERSES the earlier rule that rejected `[deploy].secrets` for hetzner-vps. See [deploy-env.md](deploy-env.md) + [config.md](config.md).
26. **`[deploy].secrets` entries are must-exist names OR `{name, generate, length}` auto-generated tables** — `ensureGeneratedSecrets` pushes absent values at provision, idempotent + non-rotating; GitHub freezes secrets at job start, so the contract is *provision → re-trigger deploy*. See [config.md](config.md).
27. **R2 buckets are `{ name, cdn }` tables with an opt-in public CDN domain** — `cdn = true` attaches `<alias>.cdn.<deploy domain>` + `R2_BUCKET_<ALIAS>_URL`; the deploy domain is resolved ONCE upstream and threaded down. See [r2-service.md](r2-service.md).
