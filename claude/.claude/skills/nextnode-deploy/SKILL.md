---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure).
  Config-driven CI/CD CLI for Cloudflare Pages, Hetzner VPS, and Cloudflare
  Workers deploys. Load when a repo has nextnode.toml,
  @nextnode-solutions/infrastructure in package.json, or the user mentions
  NextNode deploys.
user-invocable: true
synced-at: e2d2030
---

# @nextnode-solutions/infrastructure

Config-driven CI/CD CLI for NextNode projects. Reads `nextnode.toml`, runs quality gates, deploys to Cloudflare Pages, Hetzner VPS, or Cloudflare Workers, parses publish results, and enforces prod gates.

**Source**: `packages/infrastructure` in `@nextnode/core`
**Binary**: runs via `node src/index.ts <command>` (Node 24 native TS)

## Instructions

Always read the actual code before answering - start with `packages/infrastructure/src/` and `packages/infrastructure/CLAUDE.md`.

## CLI commands

| Command | Type | What it does |
|---------|------|-------------|
| `plan` | config | Parse `nextnode.toml`, output quality matrix + plan outputs |
| `detect-migration-changes` | config | Compare `base..head` against `migrations_folder` (default `drizzle/`), emit `migrations_changed` to gate the `migrate` job. Fails safe to `true` on an undiffable range. See [pipeline.md](pipeline.md) |
| `teardown-guard` | config | Validate teardown preconditions before destruction |
| `provision` | deploy | Provision infra (Pages project + domains; Hetzner VPS + R2 + CDN domains; or Cloudflare Workers Terraform apply — D1/KV/Queues/R2 + PlanetScale/Hyperdrive + DNS/redirects), then bootstrap auto-generated `[deploy].secrets` via `ensureGeneratedSecrets` |
| `plan-infra` | deploy | Cloudflare Workers only. `terraform init` + `terraform plan` (`-detailed-exitcode`); posts the create/update/delete diff as a PR comment when `PIPELINE_PR_NUMBER` is set, else to the step summary. See [cloudflare-workers.md](cloudflare-workers.md) |
| `deploy` | deploy | Merge target/services/secrets envs, sync to target, deploy app |
| `dns` | deploy | Reconcile Cloudflare DNS records (A for VPS, CNAME for Pages) |
| `teardown` | deploy | Tear down provisioned infra; captures a final wal-g backup first; volumes + both backup buckets preserved unless `--wipe-backups`. See [multi-service.md](multi-service.md) teardown |
| `migrate-remote` | deploy | Run `migrate_command` in an ephemeral container between `provision` and `deploy` (no pre-migrate snapshot — wal-g covers it). No-op without `[services.postgres]`; gated by `detect-migration-changes` (`migrations_changed`). See [postgres-service.md](postgres-service.md) |
| `seo-guard` | deploy | Inject `_headers` + `robots.txt` into build output for non-prod envs |
| `generate-worker-types` | deploy | Cloudflare Workers only (no-op elsewhere). Render `worker-configuration.d.ts` per Worker from the same `WranglerDocument` deploy uses, so `import { env } from 'cloudflare:workers'` is typed. Committed in the consumer repo; CI regenerates + `git diff --exit-code` guards drift. See [cloudflare-workers.md](cloudflare-workers.md) |
| `prod-gate` | standalone | Verify dev pipeline passed before production deploy |
| `publish` | standalone | Run `pnpm exec semantic-release` for a `type=package` project (with git release-push recovery on a failed tag push) |
| `publish-result` | standalone | Parse semantic-release output, write status/version/summary |
| `compute-image-ref` | standalone | Resolve the per-service `image_refs` JSON Record, render `docker-bake.json` from `nextnode.toml` (two-layer cache per target: ephemeral GHA scope + durable GHCR `:buildcache` registry scope), emit `bake_file`. See [pipeline.md](pipeline.md) |
| `build-golden-image` | standalone | Build + snapshot a Hetzner golden image (Docker preinstalled), keyed by deterministic fingerprint, prunes old snapshots. Replaces Packer. See [golden-image.md](golden-image.md) |
| `recover` | standalone | Recover/rebuild VPS state from Hetzner labels when local state is lost |
| `restore` | standalone | Restore a postgres backup from R2 by timestamp. Destructive (`pg_restore --clean`) - requires explicit `--yes`. See [postgres-service.md](postgres-service.md) |
| `prune-backups` | standalone | Prune old postgres backups from the R2 backup bucket (GFS retention). Benign no-op when creds are absent or the bucket is wiped. See [postgres-service.md](postgres-service.md) |
| `reconcile-tailnet-acl` | standalone | Reconcile the single Tailscale ACL grant the monitoring stack needs (scrape + Vector log push). Idempotent and NON-FATAL — a missing `acl` OAuth scope (403) is an actionable warning, never a deploy break. See [observability-service.md](observability-service.md) |

Commands are registered in `index.ts` in three maps: `PLAN_COMMANDS`, `DEPLOY_COMMANDS`, `STANDALONE_COMMANDS`. Deploy commands receive a `DeployableConfig` and are skipped (logged "non-deployable project") for `type=package`.

## Folder structure

See [structure.md](structure.md) for the full annotated tree of `src/cli/`, `src/domain/`, `src/adapters/`, `src/config/`, and `src/kernel/` (kernel rationale: structure.md rule 5). The strict layer import rules live in `packages/infrastructure/CLAUDE.md`.

## Config: nextnode.toml

See [config.md](config.md) for full schema, types, and env var reference.

## DeployTarget interface

Provider-agnostic abstraction. See [deploy-env.md](deploy-env.md) and `src/domain/deploy/target.ts` for the full TS interface, env contract, and orchestration rules.

Implemented targets: `CloudflarePagesTarget` (static sites), `HetznerVpsTarget` (containerized apps), and `CloudflareWorkersTarget` (N Workers on Cloudflare's edge, provisioned via Terraform + deployed via wrangler — `app` projects that set `target = "cloudflare-workers"` explicitly). Workloads are declared per project under `[deploy.services.<name>]` — N services per project, everything keyed off the declared name. Per-service routing/env/image/teardown invariants live in [multi-service.md](multi-service.md); the Hetzner VPS architecture deep-dive in [hetzner-vps.md](hetzner-vps.md); the Cloudflare Workers target deep-dive in [cloudflare-workers.md](cloudflare-workers.md).

## Backing services

Pluggable per-service abstraction in `domain/services/`. Each service contributes a `{public, secret}` env block, just like a `DeployTarget` - they merge through the same primitive (`mergeServiceEnvs`) with collision detection. Registered services live in `SERVICE_NAMES` (`config/types.ts`) and force every service-aware site (validators, env merger, future routers) to handle them via mapped types.

Currently registered (`SERVICE_NAMES`): `r2`, `postgres`, `observability`, `d1`, `kv`, `queues`, `planetscale`. `SERVICE_SUPPORTED_TARGETS` gates which target realizes each — `r2` spans `hetzner-vps` + `cloudflare-workers`; `postgres`/`observability` are `hetzner-vps` only; `d1`/`kv`/`queues`/`planetscale` are `cloudflare-workers` only.

- **R2** (Cloudflare object storage, both targets). Declared as a table-array of `{ name, cdn }` buckets under `[[services.r2.buckets]]`; `cdn = true` attaches a public custom domain + `R2_BUCKET_<ALIAS>_URL`. On Workers it is realized by the Terraform block instead of the imperative VPS adapter. See [r2-service.md](r2-service.md).
- **Postgres** (Hetzner only). Declared in `[services.postgres] mode = "embedded" | "external"` — embedded sidecar + **dual prod backups** (daily pg_dump with GFS retention in `<project>-backups-dump` + continuous wal-g WAL archiving & daily base backups in `<project>-backups`), auto-restore on a fresh VPS, final backup before teardown; or external `DATABASE_URL`. See [postgres-service.md](postgres-service.md).
- **Observability** (Hetzner only). Declared in `[services.observability]` (`logs_retention`, `metrics_retention_months`, `logs_vhost`, `metrics_vhost`) — self-hosted VictoriaLogs + VictoriaMetrics + vmagent + vmalert + Alertmanager + blackbox, injected as compose sidecars, scraping golden-image exporters (node_exporter/cAdvisor/postgres-exporter) over the tailnet. No external provisioning. See [observability-service.md](observability-service.md).
- **D1 / KV / Queues** (Cloudflare Workers only). `[services.d1]` (single DB → `env.DB`), `[[services.kv.namespaces]]` (→ `KV_<ALIAS>`), `[[services.queues]]` (→ producer `QUEUE_<ALIAS>`). Terraform-backed (`SERVICE_DEFINITIONS` uses `terraformBackedServiceDefinition`); a Worker binds one by listing it in `needs`. See [cloudflare-workers.md](cloudflare-workers.md).
- **PlanetScale** (Cloudflare Workers only). `[services.planetscale]` (`cluster_size`, `region`, both optional) → a managed PlanetScale Postgres DB `<project>-<env>-planetscale`, reached from every Worker with `needs = ["planetscale"]` through a Cloudflare Hyperdrive binding (`env.HYPERDRIVE`). Create-if-absent API adapter (the PlanetScale TF provider has no DB resource); Terraform owns the Postgres role + Hyperdrive config. The only service impliable from a bare `needs` (`SERVICE_IMPLIABLE_FROM_NEEDS`). See [cloudflare-workers.md](cloudflare-workers.md).

Supabase was a scaffolded backing service and was **removed** (`refactor(infrastructure): remove the incomplete supabase backing service`) — `grep supabase src` is empty. Do not document it as available.

## Observability

`[services.observability]` stands up a self-hosted metrics + logs + alerting stack (VictoriaLogs + VictoriaMetrics + vmagent + vmalert + Alertmanager + blackbox) as compose sidecars on the monitoring VPS. It registers in `SERVICE_NAMES` like other backing services but provisions nothing external — all state is local compose volumes, so `provision` is a no-op. vmagent (the only host-networked component) scrapes golden-image exporters (node_exporter `:9100`, cAdvisor `:9101`, postgres-exporter `:9187`) over the tailnet via http_sd on the primary app's `/api/sd/targets` + `/api/sd/probes`. Caddy fronts the `logs_vhost`/`metrics_vhost` on loopback (tailnet-only) and its JSON access logs feed VictoriaLogs. Secrets (`RESEND_API_KEY`, `HEALTHCHECKS_PING_URL`) flow through `[deploy].secrets` and are optional. See [observability-service.md](observability-service.md).

## Scheduled jobs (cron)

`[[deploy.cron]]` declares scheduled HTTP jobs **entirely in `nextnode.toml`** (Hetzner only). Each `{ name, schedule, path, method?, service? }` fires an internal request at one of the project's services (`http://<service>:<port><path>`, default = primary service) on a 5-field cron schedule. Validation: each schedule field is parsed against its real range + grammar (out-of-range, inverted ranges, `*/0`, macros fail loud); `path` must be absolute and free of whitespace/quotes (it is single-quoted into the wget command); the service name `cron` is reserved for the sidecar. `buildCronScheduler` (`domain/services/cron.ts`) renders all jobs into a single `cron` sidecar (alpine BusyBox `crond` + `wget`, single-quoted URLs) spread into the compose file by `renderComposeFile` — no host port, no Docker socket, no app-image dependency, no external config. Runs in **both dev and prod**, isolated per stack. Rejected on `cloudflare-pages`. NOT a `[services.*]` backing service — it contributes no env, just a compose sidecar. See [cron-service.md](cron-service.md).

## SEO guard

Prevents search engine indexing of non-production deploys. Runs after `pnpm build`, before Cloudflare Pages deploy.

- **Domain**: `computeSeoGuardFiles(environment)` - returns `_headers` (X-Robots-Tag: noindex) + `robots.txt` (Disallow: /) for non-prod, empty array for prod
- **Adapter**: `injectFiles(buildDirectory, files)` - writes files to build output
- **CLI**: `seoGuardCommand` - orchestrates domain + adapter, reads `BUILD_DIRECTORY` env var

## GitHub org (secrets, nextnode-ci app, environments)

See [github-org.md](github-org.md): the 3 secret layers (org / repo-env /
repo) with live `gh` retrieval commands — never a maintained list —, the
`nextnode-ci` GitHub App minting installation tokens for CI, environments,
generated-secret bootstrap, CI debugging commands.

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
10. **Project secrets are GitHub env-secrets, never org-secrets** — per-project credential → env-secret (`EnvSecretsAdapter`); cross-project credential (e.g. `TF_API_TOKEN`) → org-secret. See [github-org.md](github-org.md).
11. **Idempotent provision skips on present; generated secrets never rotate** — `ensureGeneratedSecrets` pushes only ABSENT `{name, generate, length}` values (regenerating would invalidate live tokens / break DB connections); a present secret is left untouched. See rule 26 + [config.md](config.md).
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
22. **Per-service teardown for DNS and Caddy; containers come down project-wide** — volumes preserved unless `--wipe-backups`. See [multi-service.md](multi-service.md) teardown.
23. **Two doors for config — build args vs runtime secrets — and they never cross** — secrets MUST NEVER be build args (they bake into image layers / `docker history`); build-time secrets use `RUN --mount=type=secret`. See [deploy-env.md](deploy-env.md) Build args.
24. **Per-service secret projection is least-privilege by construction — no broadcast** — `buildServiceSecretEnv` routes USER secrets by own `secrets`, BACKING secrets by `needs` (provenance via `secretOrigins`); the DB/backup/migrate shared `.env` gets BACKING secrets only. See [deploy-env.md](deploy-env.md).
25. **`[deploy].secrets` is the GLOBAL secret pool — injected into every service (both targets)** — folded into each service via `expandServiceSecrets`; this REVERSES the earlier rule that rejected `[deploy].secrets` for hetzner-vps. See [deploy-env.md](deploy-env.md) + [config.md](config.md).
26. **`[deploy].secrets` entries are must-exist names OR `{name, generate, length}` auto-generated tables** — `ensureGeneratedSecrets` pushes absent values at provision, idempotent + non-rotating; GitHub freezes secrets at job start, so the contract is *provision → re-trigger deploy*. See [config.md](config.md).
27. **R2 buckets are `{ name, cdn }` tables with an opt-in public CDN domain** — `cdn = true` attaches `<alias>.cdn.<deploy domain>` + `R2_BUCKET_<ALIAS>_URL`; the deploy domain is resolved ONCE upstream and threaded down. See [r2-service.md](r2-service.md).
28. **Production VPS proxying depends on subdomain depth** — Cloudflare's free Universal SSL covers only the zone apex + a single-level wildcard, so a host two+ labels deep is grey-clouded (DNS-only) and Caddy's origin Let's Encrypt cert serves it. `isCoveredByUniversalSsl` decides; dev + internal records are never proxied. See [hetzner-vps.md](hetzner-vps.md).
29. **Embedded postgres runs dual, prod-only backups; planned teardowns are zero-loss** — daily pg_dump (GFS, `<project>-backups-dump`) ∥ continuous wal-g WAL + base backups (`<project>-backups`); a fresh VPS auto-restores, and teardown captures a final backup first (aborts on failure). No pre-migrate snapshot. See [postgres-service.md](postgres-service.md).
30. **Observability is a compose-only backing service** — no external provisioning, volumes stay local, `provision` is a no-op; all published ports bind loopback with Caddy (tailnet vhosts) as the trust boundary; secrets are render-time only, never app env. See [observability-service.md](observability-service.md).
31. **Workers reach each other on service bindings ONLY — never peer URLs** — `needs = ["<sibling-worker>"]` emits a `WranglerServiceBinding` (`binding = <NAME_SNAKE>`, `service = <project>-<env>-<sibling>`); at runtime `env.<NAME>` is a `Fetcher` (RPC, no DNS/TLS/public hostname). `buildWorkerVars` never injects a `<NAME>_URL` for a sibling worker (contrast the VPS). The binding graph also orders the sequential deploy (a cycle throws). See [cloudflare-workers.md](cloudflare-workers.md).
32. **PlanetScale Postgres reaches Workers only through Hyperdrive** — `[services.planetscale]` → DB `<project>-<env>-planetscale` via a create-if-absent API adapter (no PlanetScale TF db resource); Terraform owns the DML-only `hyperdrive` Postgres role + the `cloudflare_hyperdrive_config`; `needs = ["planetscale"]` emits `env.HYPERDRIVE`. Origin credentials live in Terraform state only — **no env var is projected**. Needs `PLANETSCALE_SERVICE_TOKEN_ID` + `PLANETSCALE_SERVICE_TOKEN` when declared. See [cloudflare-workers.md](cloudflare-workers.md).
33. **`worker-configuration.d.ts` is generated from the deploy wrangler doc, committed, and drift-guarded** — `generate-worker-types` renders the SAME `WranglerDocument` deploy uses (placeholder outputs, names only) into the app package root, so a binding can never be typed-but-not-deployed or vice versa. Runs at typecheck/build, never deploy; CI regenerates + `git diff --exit-code` (with `--intent-to-add`) fails on drift or a missing file. See [cloudflare-workers.md](cloudflare-workers.md).
34. **Workers Logs are on by default** — the generated wrangler config always emits `observability: { enabled: <service.observability> }`, defaulting `true`. Opt out per Worker with `observability = false` in its `[deploy.services.<name>]` table (high-traffic Workers near the 20M-events/month Paid allowance). Distinct from the Hetzner `[services.observability]` VictoriaMetrics stack. See [cloudflare-workers.md](cloudflare-workers.md).
