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
| `provision` | deploy | Provision infra (Pages project + domains, or Hetzner VPS + R2 services + R2 public CDN domains), then bootstrap auto-generated `[deploy].secrets` via `ensureGeneratedSecrets` |
| `deploy` | deploy | Merge target/services/secrets envs, sync to target, deploy app |
| `dns` | deploy | Reconcile Cloudflare DNS records (A for VPS, CNAME for Pages) |
| `teardown` | deploy | Tear down provisioned infra (VPS + DNS, or Pages project + domains + R2), detaching each `cdn` bucket's custom domain on `project` scope. Volumes are preserved by default; pass `wipeBackups` to drop them |
| `migrate-remote` | deploy | Stage rollout + take pre-migrate R2 snapshot + run `migrate_command` in an ephemeral container on the network. Runs between `provision` and `deploy` for projects with `[services.postgres]`. No-op when postgres is not declared |
| `seo-guard` | deploy | Inject `_headers` + `robots.txt` into build output for non-prod envs |
| `prod-gate` | standalone | Verify dev pipeline passed before production deploy |
| `publish-result` | standalone | Parse semantic-release output, write status/version/summary |
| `compute-image-ref` | standalone | Resolve a per-service `image_refs` JSON Record (`build` services get a `ghcr.io/<owner>/<repo>-<service>:sha-<7>` ref; `upstream` services keep their declared `ref`), render `docker-bake.json` from `nextnode.toml` at the workspace root, and emit its basename as the `bake_file` output for `docker/bake-action` |
| `build-golden-image` | standalone | Build + snapshot a Hetzner golden image (Docker preinstalled), keyed by deterministic fingerprint, prunes old snapshots. Replaces Packer. See [golden-image.md](golden-image.md) |
| `recover` | standalone | Recover/rebuild VPS state from Hetzner labels when local state is lost |
| `restore` | standalone | Restore a postgres backup from R2 by timestamp (most-recent dump <= `--at`). Destructive (`pg_restore --clean`) - requires explicit `--yes`. See [postgres-service.md](postgres-service.md) |
| `rotate-pg-exporter-password` | standalone | Force-rotate `PG_EXPORTER_PASSWORD` GitHub env-secret with a fresh 32-byte base64 value. Operator runbook: `ALTER ROLE postgres_exporter PASSWORD '<new>'` on the live db first, then re-trigger deploy so the refreshed `ALL_SECRETS` reaches compose `.env`. See [supabase-service.md](supabase-service.md) |

Commands are registered in `index.ts` in three maps: `PLAN_COMMANDS`, `DEPLOY_COMMANDS`, `STANDALONE_COMMANDS`. Deploy commands receive a `DeployableConfig` and are skipped (logged "non-deployable project") for `type=package`.

## Folder structure

See [structure.md](structure.md) for the full annotated tree of `src/cli/`, `src/domain/`, `src/adapters/`, `src/config/`, and `src/kernel/` (the layer-agnostic floor of pure primitives — stdlib only, no in-app imports — added so runtime helpers like `isRecord` can be shared across the `config`↔`domain` boundary). The strict layer import rules (domain pure, adapters never decide, CLI orchestrates, kernel imports nothing in-app) live in `packages/infrastructure/CLAUDE.md`.

## Config: nextnode.toml

See [config.md](config.md) for full schema, types, and env var reference.

## DeployTarget interface

Provider-agnostic abstraction. See [deploy-env.md](deploy-env.md) and `src/domain/deploy/target.ts` for the full TS interface, env contract, and orchestration rules.

Implemented targets: `CloudflarePagesTarget` (static sites) and `HetznerVpsTarget` (containerized apps). Workloads are declared per project under `[deploy.services.<name>]` — N services per project are accepted. The compose, env file, host-port mapping, `/healthz` probe, migrate container, DNS records, Caddy upstreams and deploy summary all key off the declared name (no hardcoded `app`). Per-service routing (one DNS record + one Caddy upstream per service that declares a `url`), per-service env isolation (`.env.<name>` with symmetric cross-service URL injection), per-service image refs (`Record<service, ImageRef>`) and per-service teardown are all wired today.

See [multi-service.md](multi-service.md) for the per-service routing/env/image/teardown invariants, and [hetzner-vps.md](hetzner-vps.md) for the Hetzner VPS architecture deep-dive.

## Backing services

Pluggable per-service abstraction in `domain/services/`. Each service contributes a `{public, secret}` env block, just like a `DeployTarget` - they merge through the same primitive (`mergeServiceEnvs`) with collision detection. Registered services live in `SERVICE_NAMES` (`config/types.ts`) and force every service-aware site (validators, env merger, future routers) to handle them via mapped types.

Currently registered:

- **R2** (Cloudflare object storage). Declared per-project as a table-array of `{ name, cdn }` buckets under `[[services.r2.buckets]]`. `cdn = true` (default `false` → private) attaches a public Cloudflare custom domain `<alias>.cdn.<domain>` and injects `R2_BUCKET_<ALIAS>_URL`. See [r2-service.md](r2-service.md).
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

Two distinct "doors" carry config into a service, each with its own channel and rule (the dev declares only NAMES — values always live in GitHub, never in `nextnode.toml`):

- **BUILD door** — values inlined into the image at build time (Astro `site`, `NEXT_PUBLIC_*`, `VITE_*`). A `.env` does NOT traverse the Docker build; only build args do. `build_args = [...]` lists the dev's extra build-arg NAMES (resolved against `ALL_VARS` = `toJSON(vars)`); `SITE_URL` is auto-injected into every `build` target. Secrets MUST NEVER be build args (they bake into image layers / `docker history`).
- **RUNTIME door** — values injected via compose `env_file` at run time. Per-service `secrets = [...]` lists runtime secret NAMES (resolved from `ALL_SECRETS`), projected into THIS service's `.env.<name>` only (least privilege — no broadcast). `[deploy].secrets` is the GLOBAL pool (both targets): every name there is folded into every service. Entries may be must-exist names OR `{ name, generate, length }` tables the infra auto-generates (see rules 25–26).

See [deploy-env.md](deploy-env.md) for the full build-arg + secret-projection flow and SITE_URL computation.

## Kickstarting a new package

See [kickstart-package.md](kickstart-package.md) for the complete guide.

## Hetzner caller convention

See [hetzner-caller.md](hetzner-caller.md) for what a project repo must provide (`Dockerfile`, `nextnode.toml` build shape, infra-owned runtime concerns, caller workflow files).

## Rules

1. **Check the code, not assumptions** - only reference features that exist in source
2. **`resolveDeployDomain` is the single source of truth** for dev subdomain convention - never inline `dev.{domain}`. It's reused by `dns-records.ts`, `service-env.ts` and `service-upstreams.ts` so DNS, env, and Caddy all resolve the same hostname per service.
3. **SITE_URL is always auto-computed, at BOTH build and runtime, from one source** - `computeSiteUrl(domain, environment)` (`domain/deploy/domain.ts`, `https://<resolveDeployDomain(...)>`) is the single source of truth. Every DeployTarget MUST put SITE_URL in `contributeEnv().public` (the orchestrator narrows the merged env via `buildDeployEnv()` and throws if it's missing), AND `compute-image-ref` injects the same value as a build arg into every `build` target via `computePublicBuildArgs`. Both Hetzner and Cloudflare targets route through `computeSiteUrl`, so the value baked into the image and the value injected at runtime cannot drift. The dev never declares SITE_URL anywhere.
4. **Single source of truth for all defaults** - every config default lives in `config/types.ts` as a named constant. Validators import these constants - they never define their own inline defaults. If a concept doesn't apply to a project type, there must be NO default for it
5. **DeployTarget hides provider details** - no SSH/Docker/hcloud/Caddy in public types. Adding a new provider = new adapter, zero CLI change
6. **Backing services compose like targets** - every service contributes a `{public, secret}` `ServiceEnv`; targets and services merge through `mergeServiceEnvs`. Two services claiming the same env key throws (collision = bug, not silent overwrite)
7. **Strict layer rules apply** - domain is 100% pure (no IO/env/logger), adapters never make business decisions, CLI orchestrates. See `packages/infrastructure/CLAUDE.md` for the full enforcement table.
8. **Postgres migrations run from CI, not from the app** - migrations execute in the `migrate-remote` job between `provision` and `deploy` via an ephemeral container on the project network, after a pre-migrate R2 snapshot. App entrypoints MUST NOT run migrations on startup (race conditions across rotating replicas, no rollback safety net). The `migrate_command` defaults to `pnpm drizzle-kit migrate` - override only for non-Drizzle stacks.
9. **A postgres NextNode version is a fleet-wide pin** - `NEXTNODE_POSTGRES_VERSION` (`domain/services/postgres.ts`) is the single source of truth for the server image AND the backup sidecar image. Clients do not pick their version - NextNode bumps the constant to roll out a new major across every embedded deploy. `mode = "external"` users own their version.
10. **Project secrets are GitHub env-secrets, never org-secrets** - any credential scoped to one project goes through `EnvSecretsAdapter` (`adapters/github/env-secrets.ts`) which calls `gh secret set <NAME> --repo <owner>/<repo> --env <environment>`. `OrgSecretsAdapter` is reserved for cross-project credentials shared across the entire `NextNodeSolutions` org (Cloudflare API tokens, Hetzner API tokens). Heuristic: per-project credential → env-secret; cross-project credential → org-secret. The `PG_EXPORTER_PASSWORD` flip from org-secret to env-secret (commit `7dcede5`) is the canonical reference for this distinction.
11. **Idempotent provision skips on present; rotate is an explicit command** - service `provision()` reads `repoSecrets[name]` and **never overwrites** an existing value (auto-generating a fresh `JWT_SECRET` on every run would invalidate every issued token; rotating `POSTGRES_PASSWORD` would split-brain the initdb-baked role). Rotations are dedicated standalone CLI commands (e.g. `rotate-pg-exporter-password`) with operator runbook steps documented inline.
12. **Service name is declared, never hardcoded; N services per project** - workloads under `[deploy.services.<name>]` flow by their DECLARED name end-to-end: per-service GHCR repo suffix (`<owner>/<repo>-<name>`), per-service env file (`.env.<name>`), per-service host-port allocation, per-service bake target, per-service DNS record, per-service Caddy upstream, per-service depends_on graph, and the migrate container's image lookup. The compose renderer keys everything off `Object.entries(services)` and there is no `resolveSoleService` anymore (dropped in commit `688f187`). Anything reaching for a literal `"app"` is a bug.
13. **IMAGE_REFS is a JSON Record, not a bare ref** - the deploy + migrate jobs read a JSON object mapping each declared service to its `{registry, repository, tag}`, parsed through `parseImageRefsEnv`. Plan emits `upstream_image_refs` for the upstream path (`Record<service, ImageRef>`, one entry per service) and `compute-image-ref` writes `image_refs` + `bake_file` (the basename of a `docker-bake.json` it renders from `nextnode.toml` at the workspace root, carrying each `build` target's `context` / `dockerfile` / optional stage `target` / `tags` / GHA `cache-from` / `cache-to`). The legacy single-string `IMAGE_REF` / `image_ref` output was removed (`refactor(infrastructure): drop legacy deploy.image schema and image_ref output`), and the `bake_targets` CSV + `bake_set` multiline outputs were replaced by the rendered `bake_file` (`feat(infrastructure): render docker-bake.json from nextnode.toml as the single build source`) — re-introducing a bare ref breaks `parseImageRefsEnv` and the upstream path.
14. **/healthz is scoped to `build` services; depends_on gating adapts** - the wget-based liveness probe in `renderComposeFile` is only attached to services whose `source = "build"`. NextNode build images ship `wget` + the `/healthz` route on their alpine/distroless-busybox bases; `upstream` images are pulled verbatim and may answer neither, so forcing the probe would flag them `unhealthy`. Consequence for `depends_on`: dependents gate on `service_healthy` (build) or `service_started` (upstream) — the renderer picks per Y's source. Per-service healthcheck overrides for upstream land later.
15. **Cross-phase compose identity** - phase 1 (`stageRollout` → `bringUpDb`) and phase 2 (`bringUpApp`) BOTH act on the same compose file rendered by `renderComposeFile` with the SAME inputs. Phase 2 is a bare `docker compose up -d --remove-orphans` (no positional service): it rotates user services to their new image while leaving the already-healthy postgres untouched because its compose entry is byte-identical across phases. Any change that makes the postgres/supabase block differ between phases would recreate the DB phase 1 just `--wait`-ed healthy — keep backing-service rendering deterministic across calls.
16. **Config validation is valibot-based** - every `[deploy]`, `[deploy.services.<name>]`, `[services.*]` schema lives in `src/config/validation/` as a valibot pipe. Each `runSchema` call uses `abortEarly: false` + explicit per-action messages, so a single parse accumulates every error and the messages are the user-facing nextnode.toml strings. Validators import field builders (`nonEmptyString`, `optionalNonEmpty`, `stringArray`, `optionalStringOrFalse`, `forbiddenField`) from `config/validation/valibot.ts` — never inline new schemas. The `config` layer's only deps are stdlib + smol-toml + valibot + `kernel/*` (no domain, no adapters, no cli).
17. **All services share one `source`; mixing build and upstream is rejected** - validated in `config/validation/providers/hetzner.ts`. The pipeline forwards a single registry token to the deploy step, the bake step builds all services at once. Trying to bake a subset and pull the rest leaks the build/upstream split across two image-resolution paths. If a project genuinely needs both, split it into two `nextnode.toml`s (two GitHub workflows, two VPS silos).
18. **Service `url` is unique and within `project.domain`** - validated in `providers/hetzner.ts` (uniqueness + domain-scope). A routed service gets exactly one DNS record (one A record per `url`, computed by `dns-records.ts`), one Caddy upstream (built by `service-upstreams.ts`), one host port (allocated by `allocateHostPort`). Services without `url` are internal-only (compose-network reach only — siblings dial `<service-name>:<port>`).
19. **Cross-service URLs are injected symmetrically with `https://`** - `buildServiceEnvFiles` (`domain/hetzner/service-env.ts`) writes one `.env.<service>` per declared service. Every file contains every routed sibling's URL as `<SIBLING_NAME_UPPER_SNAKE>_URL=https://<resolved-hostname>` (including the service's own URL). Symmetric injection removes the need for any service to know which peers depend on it. The `https://` prefix is in the value, so app code consumes it verbatim — no concatenation in callers (see commit `72eb402`).
20. **Registry auth is homogeneous per deploy** - one token is forwarded to the SSH session. Any `build` service makes the deploy use `GHCR_TOKEN`. When all services are `upstream`, they MUST reference the same `registry_auth_secret` (or all omit it). Mixing different secret names is rejected at deploy-context resolution (`resolve-deploy-context.ts`). `docker login` is only issued for the registries that token actually covers (commit `66e19c9`).
21. **Postgres-owning service is explicit** - when `[services.postgres]` is declared, exactly one service must declare `needs = ["postgres"]`. `selectMigrationService` (`domain/deploy/migration-service.ts`) throws if zero or more than one service claims it. That service's image is what the migrate-remote ephemeral container runs against; multi-db ("each service owns its own DB") is M3+ work.
22. **Per-service teardown for DNS and Caddy** - `teardown` removes one Cloudflare DNS record per routed service and scrubs the per-service upstream + route + cert subject from the shared Caddy config (commits `f28710e`, `53c3a45`). Containers come down project-wide. Volumes are preserved by default; pass `wipeBackups` to drop named volumes and R2 backups.
23. **Two doors for config — build args vs runtime secrets — and they never cross** - build-time-inlined config (Astro `site`, `NEXT_PUBLIC_*`) goes through `build_args` (the BUILD door); runtime config goes through `secrets` / backing-service env (the RUNTIME door). `build_args = ["NAME", ...]` (build services only — `forbidden` on `upstream`) lists EXTRA GitHub Variable NAMES; values come from `ALL_VARS` (`toJSON(vars)`), resolved by `resolveBuildArgs` (`domain/deploy/build-args.ts`) which fails loud when a declared name is absent (a Variable declared-but-unset is a CI bug, not a value to default away). `SITE_URL` is the infra's `autoArgs`, injected into every build target by `computePublicBuildArgs` — the dev never lists it. **Secrets MUST NEVER be build args**: a build arg bakes into image layers / `docker history` / the pushed GHCR image. Build-time secrets use `RUN --mount=type=secret`, never `build_args`. `ALL_SECRETS` and `ALL_VARS` share one parser (`readJsonRecordEnv`, `cli/env.ts`).
24. **Per-service secret projection is least-privilege by construction — no broadcast** - `buildServiceSecretEnv(services, secrets, origins)` (`domain/hetzner/service-env.ts`) routes each secret into a service's `.env.<name>` only when that service is entitled to it: a USER secret (no producer in `origins`) reaches only services that list it in their own `secrets`; a BACKING secret (produced by another service, so `origins` names its producer — e.g. `DATABASE_URL` → `postgres`) reaches only services that declare `needs = [<producer>]`. So `DATABASE_URL` lands in the schema owner's `.env`, never in a front service that does not need it. Provenance is the `secretOrigins` map (secret key → producing service) built once in `resolve-deploy-context` and threaded as data through `DeployInput.secretOrigins` → the container target (a required, possibly-empty map). Separately, the embedded-postgres sidecar (`env_file: ['.env']`), the backup sidecar (`${VAR}` interpolation) and the ephemeral migrate container (`--env-file .env`) read a SHARED bare `.env` written by `stageRollout` via `selectBackingSecrets` — the BACKING env only (`POSTGRES_*`, `R2_*`, `DATABASE_URL`), never the app's user secrets.
25. **`[deploy].secrets` is the GLOBAL secret pool — injected into every service (both targets)** - `resolveSecrets` (`config/validation/deploy.ts`, renamed from `resolveSecretPool` in `feat(infrastructure): global + auto-generated secrets and R2 public CDN domains`) folds the global `[deploy].secrets` names into each service's own `secrets` via `expandServiceSecrets` (global ∪ own, deduped, global-first), so the per-service router in `service-env.ts` — which keys off `service.secrets` — injects a global secret into every `.env.<service>` with no further wiring. For **hetzner-vps** the pull pool = that union (global ∪ every service's `secrets`); for **cloudflare-pages** (no services) the pool IS `[deploy].secrets`. **This REVERSES the earlier rule** that `[deploy].secrets` was rejected for hetzner-vps — a global pool is now first-class and that rejection error is gone. Per-service `[deploy.services.<name>].secrets` remains the least-privilege channel for a single workload. `validateServiceNeedsRefs` still gates `needs ⊆ declared [services.*]`.
26. **`[deploy].secrets` entries are must-exist names OR auto-generated tables** - a bare string is a must-exist GitHub secret (the operator set it); a `{ name, generate, length }` table is one the infra creates and pushes itself. `parseSecretEntries` (`config/validation/deploy.ts`) puts every entry's name into the pull pool and collects table entries into `deploy.generatedSecrets`; duplicate names, unknown generators, and lengths outside 8–256 fail loud at parse. Generators (`domain/deploy/secret-generation.ts`, pure + crypto-backed): `token` → base64url `[A-Za-z0-9_-]` (JWT/HS256 keys, 64 chars maps 1:1 to a byte), `password` → alphanumeric `[A-Za-z0-9]` (service/DB passwords, rejection-sampled since 62 isn't a power of two — avoids modulo bias). `length` is the produced CHARACTER count. At provision `ensureGeneratedSecrets` (`cli/deploy/ensure-generated-secrets.ts`) generates each value ABSENT from `ALL_SECRETS` and runs `gh secret set <name> --env <env>` via the same `EnvSecretsAdapter` the supabase service uses (pushes run concurrently; fails loud if gh is unavailable but a push is needed). **Idempotent + non-rotating** — a secret already in `ALL_SECRETS` is left untouched (regenerating a JWT/DB secret would invalidate every live token / break the connection). The pushed value lands in a LATER run's `ALL_SECRETS` snapshot (GitHub freezes secrets at job start), so the contract is *provision → re-trigger deploy*.
27. **R2 buckets are tables with an opt-in public CDN domain** - `[services.r2].buckets` is a table-array of `{ name, cdn }` (`R2BucketConfig`), no longer bare strings. `cdn = true` (default `false` → private) makes `provision` attach a Cloudflare **custom domain** `<alias>.cdn.<resolveDeployDomain(project.domain)>` to the bucket (`computeR2CustomDomainHostname`, `domain/cloudflare/r2/custom-domain.ts`; `ensureR2CustomDomain`, `adapters/cloudflare/r2/domains.ts`), passing the zone id so Cloudflare auto-creates the proxied CNAME (no separate DNS write), then polls `getR2CustomDomainStatus` until `ssl === "active"` (`awaitR2DomainActive`) before persisting state. The bound bucket then also gets `R2_BUCKET_<ALIAS>_URL` (its `https://` CDN URL) in the public env (`buildR2ServiceEnv`). The deploy domain is resolved ONCE upstream (`resolveServices` → `ctx.deployDomain`; `null` when the project declares no `domain`) and threaded into BOTH provision and teardown — never re-resolved, or development would double the `dev.` prefix (fix `998a233`). `project`-scope teardown detaches every `cdn` bucket's custom domain (`deleteR2CustomDomain`); `vps` scope leaves R2 untouched. The implicit supabase `backups` bucket is always `cdn: false` (internal, never public).
