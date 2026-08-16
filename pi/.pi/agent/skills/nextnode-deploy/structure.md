# `@nextnode-solutions/infrastructure` — code layout

Four-layer architecture (cli → domain + adapters + config, all sitting on top of a layer-agnostic kernel). Layer rules are STRICT and enforced in `packages/infrastructure/CLAUDE.md`.

## Layers

```
src/
  index.ts     # command registry + argv dispatch (no business logic)
  cli/         # CLI command orchestrators (read env, call domain + adapters, log milestones)
  domain/      # pure logic. NO IO, NO env, NO logger
  adapters/    # IO boundary (cloudflare/, cloudflare/workers/, hetzner/, r2/, github/, build-output/, services/, tailscale/, terraform/, hcp/, wrangler/)
  config/      # nextnode.toml schema + loader, valibot-based (see config.md)
  kernel/      # layer-agnostic floor: pure primitives, stdlib only, ZERO in-app imports
```

### Rules

1. **`domain/` is pure** — no `fetch`, no `process.env`, no logger, no FS. Pure functions only. Decision logic lives here so it's trivially testable.
2. **`adapters/` never make business decisions** — they execute what `domain/` decided. One adapter per provider (`adapters/hetzner/`, `adapters/cloudflare/`).
3. **`cli/` orchestrates** — reads config, calls domain for decisions, hands decisions to adapters for IO, prints summaries.
4. **`config/` is self-contained** — stdlib + smol-toml + valibot + `kernel/*` only. No domain, no adapters, no cli.
5. **`kernel/` is the floor** — pure primitives importable at runtime by EVERY layer (index, cli, domain, adapters, config). Stdlib only, no in-app deps. It exists so a runtime helper (`isRecord`, `parseJsonOrThrow`) can be shared across the `config`↔`domain` boundary the "types only" import rule otherwise blocks. Anything provider- or domain-specific does NOT belong here — it stays in its layer.

Imports flow inward and downward: `cli` → `domain` + `adapters` + `config` + `kernel`; `adapters` → `domain` (types) + `kernel`; `domain` → other `domain` + `kernel`; `config` → `kernel` + stdlib + smol-toml + valibot; `kernel` → stdlib only.

## Where to find what

Use `ls` / `find` for the current file map — it drifts. The full rules and architectural justification are in `packages/infrastructure/CLAUDE.md`.

Cross-cutting sub-skills:
- `config.md` — `nextnode.toml` schema and loader
- `multi-service.md` — N services per project: routing (DNS/Caddy/host ports), env isolation (`.env.<name>` + symmetric URL injection), source homogeneity, registry auth, depends_on gating, teardown
- `deploy-env.md` — `DeployEnv`, `TargetEnv`, `DeployInput`, env merge order
- `r2-service.md` — R2 buckets backing service (per-project object storage + CDN)
- `postgres-service.md` — embedded/external postgres + dual pg_dump∥wal-g backups, migrations
- `observability-service.md` — `[services.observability]` metrics/logs/alerting stack + golden-image exporters
- `cron-service.md` — `[[deploy.cron]]` scheduled-HTTP-job sidecar
- `golden-image.md` — Hetzner golden image fingerprint + cache key
- `pipeline.md` — quality matrix, prod-gate, publish-result, migrate gating, bake cache
- `hetzner-vps.md` — internal vs public mode, Caddy, firewall, DNS proxy-depth
- `hetzner-caller.md` — what a caller repo provides (Dockerfile, nextnode.toml, workflows)
- `cloudflare-workers.md` — the Workers target: Terraform/wrangler ownership boundary, HCP state, D1/KV/Queues, deploy-workers.yml, org bootstrap

Per-service domain primitives (`src/domain/hetzner/`):
- `compose-file.ts` — multi-service compose renderer (per-service blocks, depends_on gating, healthcheck scoped to build, cross-phase identity)
- `service-env.ts` — per-service runtime env: `buildServiceUrlEnv` (symmetric cross-service URL injection), `buildServiceSecretEnv` (least-privilege secret projection via `secretOrigins`), `selectBackingSecrets` (shared `.env` for DB/backup/migrate)
- `service-upstreams.ts` — one Caddy upstream per routed service
- `host-port.ts` — VPS-wide port allocation `[8080, 8200)` per routed service
- `dns-records.ts` — one A record per routed service; `isCoveredByUniversalSsl` decides proxied (apex/one-label) vs grey-clouded (two+ labels) in prod
- `compose-file.ts` (`buildPostgresServiceGroup`) — spreads backing-service sidecars (postgres/walg/backup, observability, cron) into the compose `services` map

Backing-service domain primitives (`src/domain/services/`) — each contributes a `{public, secret}` `ServiceEnv` and/or compose sidecars, merged via `mergeServiceEnvs`:
- `postgres.ts` — naming (`postgresProjectIdentifier`, `postgresBackupBucketName`, url-encoded `buildPostgresEmbeddedDatabaseUrl`), pg_dump GFS retention, restore selection, `NEXTNODE_POSTGRES_VERSION`
- `postgres-walg.ts` — wal-g server (`archive_command`, restore-on-empty) + base-backup loop sidecar, `postgresWalgBucketName`, prod-only
- `postgres-exporter.ts` — embedded-postgres exporter sidecar (`DATA_SOURCE_URI`/`USER`/`PASS`), always rendered
- `observability.ts` — VictoriaLogs/Metrics + vmagent/vmalert + Alertmanager + blackbox stack (images/ports/volumes/mem caps); `observability.service.ts` contributes empty env
- `cron.ts` — `buildCronScheduler` renders the `cron` BusyBox sidecar from `[[deploy.cron]]`
- `r2.ts` — R2 bucket env

Shared deploy domain primitives (`src/domain/deploy/`):
- `domain.ts` — `resolveDeployDomain` (dev subdomain) + `computeSiteUrl` (single SITE_URL source, build + runtime)
- `build-args.ts` — `computePublicBuildArgs` (auto SITE_URL) + `resolveBuildArgs` (autoArgs ∪ dev-declared `build_args`, fail-loud against `ALL_VARS`)
- `bake-file.ts` — `renderBakeFile` (docker-bake.json from nextnode.toml; `BakeTarget.args` carries build args)
- `image-ref.ts` — `computeImageRef` / `parseImageRef` / `resolveServiceImageRefs` / `parseImageRefsEnv` / `selectServiceImage`
- `migration-service.ts` — selects the postgres-owning service from `needs = ["postgres"]`
- `secret-generation.ts` — `generateSecretValue` (pure, crypto-backed) for auto-generated `[deploy].secrets` (`token`/`password`, rejection-sampled). Pushed at provision by `cli/deploy/ensure-generated-secrets.ts`.
- `terraform-config.ts` / `terraform-main-config.ts` / `terraform-resources.ts` / `terraform-redirects.ts` / `terraform-outputs.ts` / `terraform-labels.ts` — pure `config → main.tf.json` generation for the `cloudflare-workers` target (cloud block org `nextnode` + workspace `<project>-<env>`, provider `cloudflare/cloudflare ~> 5.0`, zone as `data`, D1/KV/Queues/R2/DNS resources, `.fr → .com` Redirect Rulesets prod-only). No `cloudflare_workers_script` — that side is wrangler's.

Cloudflare Workers target primitives:
- `domain/cloudflare/workers/` — `worker-name.ts` (`computeWorkerScriptName` = `<project>-<env>-<service>`), `wrangler-document.ts` (`WranglerDocument` shape + constants: `DEFAULT_WORKERS_COMPATIBILITY_DATE`, `WORKERS_COMPATIBILITY_FLAGS`, `WORKERS_D1_BINDING`), `wrangler-config.ts` (`buildWranglerConfig`), `worker-vars.ts` (`buildWorkerVars`: needs-filtered backing env ∪ SITE_URL — NEVER sibling `<NAME>_URL`s; worker-to-worker addressing is a service binding, SKILL.md rule 31), `outputs-env.ts` (Terraform outputs → `ServiceEnv`), `assets-directory.ts` (derive the static-assets dir from the entry), `smoke-check.ts` (`/healthz` per routed service), `hcp-workspace.ts` (`EXECUTION_MODE_LOCAL`), `worker-env-types.ts` (render `worker-configuration.d.ts` from the WranglerDocument), `depends-on-order.ts`, `managed-resources.ts`, `teardown.ts` (`assertWipeDataAllowed`)
- `adapters/terraform/runner.ts` — `terraform init/apply/destroy/plan/output` shell-out (lock timeout, `-detailed-exitcode`)
- `adapters/hcp/workspaces.ts` — HCP Terraform workspace create-if-absent (execution mode local) via the Terraform Cloud API
- `adapters/wrangler/` — `deploy.ts` (`wrangler deploy` + `wrangler secret bulk` from STDIN), `migrate.ts` (`wrangler d1 migrations apply --remote`), `runner.ts` (`npx --yes wrangler`, `wrangler delete --force`), `config-paths.ts`
- `adapters/cloudflare/workers/` — `target.ts` (`CloudflareWorkersTarget` implementing `DeployTarget`), `workers-provision.ts`, `provision-planetscale.ts`, `deploy-workers.ts`, `migrate-workers.ts`, `seo-guard-assets.ts`, `smoke-check.ts`, `teardown-workers.ts`, `terraform-ops.ts`, `write-worker-types.ts`

R2 public CDN primitives:
- `domain/cloudflare/r2/custom-domain.ts` — `computeR2CustomDomainHostname` (`<alias>.cdn.<resolved-domain>`) + `computeR2PublicUrl`
- `adapters/cloudflare/r2/domains.ts` — `ensureR2CustomDomain` / `getR2CustomDomainStatus` / `deleteR2CustomDomain` (CF R2 custom-domain API)
- `cli/services/r2/await-domain-active.ts` — polls SSL status until `active` before persisting the bucket's public URL
