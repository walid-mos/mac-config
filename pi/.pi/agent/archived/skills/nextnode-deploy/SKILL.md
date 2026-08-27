---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure).
  Config-driven CI/CD CLI for Cloudflare Pages, Hetzner VPS, and Cloudflare
  Workers deploys. Load when a repo has nextnode.toml,
  @nextnode-solutions/infrastructure in package.json, or the user mentions
  NextNode deploys.
---

# @nextnode-solutions/infrastructure

Config-driven CI/CD for NextNode projects: reads `nextnode.toml`, runs quality
gates, provisions and deploys Cloudflare Pages, Hetzner VPS, or Cloudflare
Workers, and enforces production gates.

- **Source snapshot**: `@nextnode/core @ 7185a94` (resync 2026-08-16)
- **Package**: `packages/infrastructure`
- **Local binary**: `node src/index.ts <command>` (Node 24 native TypeScript)
- **First instruction**: read the actual implementation in
  `packages/infrastructure/src/` and `packages/infrastructure/CLAUDE.md`; never
  infer behavior from this snapshot alone.

## CLI index

Commands are registered in `index.ts` through `PLAN_COMMANDS`,
`DEPLOY_COMMANDS`, and `STANDALONE_COMMANDS`. Deploy commands receive a
`DeployableConfig` and are skipped with `non-deployable project` for
`type=package`.

## Surface map

- **Targets**: Cloudflare Pages (static), Hetzner VPS (containers), and
  Cloudflare Workers (explicit `target = "cloudflare-workers"`).
- **Backing services**: `r2`, `postgres`, `observability`, `d1`, `kv`,
  `queues`, and `planetscale`; target support is constrained per service.
- **Removed**: `supabase` is not available and must not be documented as one.
- **Workloads**: declare N services under `[deploy.services.<name>]`; names,
  routing, env, images, and teardown are all service-scoped.

| Map | Commands | Canonical detail |
|---|---|---|
| **Config** | `plan`, `detect-migration-changes`, `teardown-guard` | [config.md](config.md), [pipeline.md](pipeline.md) |
| **Deploy** | `check-secrets`, `provision`, `plan-infra`, `deploy`, `dns`, `teardown`, `migrate-remote`, `seo-guard`, `generate-worker-types`, `compute-image-ref` | [pipeline.md](pipeline.md), [multi-service.md](multi-service.md), [cloudflare-workers.md](cloudflare-workers.md) |
| **Standalone** | `prod-gate`, `publish`, `publish-result`, `build-golden-image`, `recover`, `restore`, `prune-backups`, `reconcile-tailnet-acl` | [pipeline.md](pipeline.md), [golden-image.md](golden-image.md), [postgres-service.md](postgres-service.md), [observability-service.md](observability-service.md) |

## Reference index

| Concern | Reference |
|---|---|
| Source tree and layer boundaries | [structure.md](structure.md) |
| TOML schema and environment variables | [config.md](config.md) |
| DeployTarget, build/runtime env, and SITE_URL | [deploy-env.md](deploy-env.md) |
| Multi-service routing, images, registry, and teardown | [multi-service.md](multi-service.md) |
| Hetzner VPS | [hetzner-vps.md](hetzner-vps.md) |
| Cloudflare Workers, bindings, Terraform, D1/KV/Queues/PlanetScale | [cloudflare-workers.md](cloudflare-workers.md) |
| R2 buckets and CDN | [r2-service.md](r2-service.md) |
| Postgres, migrations, backups, and restore | [postgres-service.md](postgres-service.md) |
| Observability sidecars and tailnet access | [observability-service.md](observability-service.md) |
| Scheduled HTTP jobs | [cron-service.md](cron-service.md) |
| GitHub secrets, App, and environments | [github-org.md](github-org.md) |
| New package setup | [kickstart-package.md](kickstart-package.md) |
| Consumer repository contract | [hetzner-caller.md](hetzner-caller.md) |

## Cross-cutting invariants

The numbering is retained because reference files cite `SKILL.md rule N`.
Details belong in the linked reference, not here.

| # | Invariant | Detail |
|---:|---|---|
| 1 | Verify source before documenting or changing behavior. | Source tree and `CLAUDE.md` |
| 2 | `resolveDeployDomain` is the sole dev-domain resolver. | [multi-service.md](multi-service.md) |
| 3 | `computeSiteUrl` is the sole build/runtime `SITE_URL` source. | [deploy-env.md](deploy-env.md) |
| 4 | Named config/domain constants are the only defaults; inapplicable concepts have no default. | [config.md](config.md) |
| 5 | `DeployTarget` hides provider details; new providers are adapters, not CLI branches. | [deploy-env.md](deploy-env.md) |
| 6 | Targets and backing services contribute `ServiceEnv` values merged with collision detection. | [multi-service.md](multi-service.md) |
| 7 | Domain is pure, adapters do IO, and CLI orchestrates. | `packages/infrastructure/CLAUDE.md` |
| 8 | Migrations run from CI between provision and deploy, never at app startup. | [postgres-service.md](postgres-service.md), [cloudflare-workers.md](cloudflare-workers.md) |
| 9 | `NEXTNODE_POSTGRES_VERSION` pins the fleet-wide embedded Postgres version. | [postgres-service.md](postgres-service.md) |
| 10 | Project credentials are environment secrets; cross-project credentials are org secrets. | [github-org.md](github-org.md) |
| 11 | Provision is idempotent; present generated secrets never rotate. | [config.md](config.md) |
| 12 | Declared service names flow end-to-end; no hardcoded `app`. | [multi-service.md](multi-service.md) |
| 13 | `IMAGE_REFS` is a JSON `Record`, not a bare image reference. | [multi-service.md](multi-service.md), [pipeline.md](pipeline.md) |
| 14 | `/healthz` probes only `build` services; dependency gating adapts by source. | [multi-service.md](multi-service.md) |
| 15 | Provision and deploy use byte-identical backing-service compose blocks. | [multi-service.md](multi-service.md) |
| 16 | Config schemas use shared valibot builders and user-facing aggregate errors. | [config.md](config.md) |
| 17 | All services share one `source`; mixing build and upstream is rejected. | [multi-service.md](multi-service.md) |
| 18 | Routed service URLs are unique and inside `project.domain`; omitted URLs are internal. | [multi-service.md](multi-service.md) |
| 19 | VPS cross-service URLs are injected symmetrically with `https://`. | [deploy-env.md](deploy-env.md) |
| 20 | Registry authentication is homogeneous per deploy. | [multi-service.md](multi-service.md) |
| 21 | Exactly one service owns Postgres migrations. | [multi-service.md](multi-service.md) |
| 22 | DNS/Caddy teardown is per service; containers are project-wide; volumes survive unless wiped. | [multi-service.md](multi-service.md) |
| 23 | Build args and runtime secrets are separate doors; secrets never become build args. | [deploy-env.md](deploy-env.md) |
| 24 | Secret projection is least-privilege; backing secrets follow declared `needs`. | [deploy-env.md](deploy-env.md) |
| 25 | `[deploy].secrets` is the global pool injected into every service. | [deploy-env.md](deploy-env.md), [config.md](config.md) |
| 26 | Global secret entries are existing names or `{ name, generate, length }` tables; bootstrap requires a deploy retry. | [config.md](config.md) |
| 27 | R2 buckets use `{ name, cdn }`; CDN domains are opt-in. | [r2-service.md](r2-service.md) |
| 28 | Production VPS proxying follows Cloudflare Universal SSL subdomain coverage. | [hetzner-vps.md](hetzner-vps.md) |
| 29 | Embedded Postgres has prod-only pg_dump and wal-g backups; planned teardown takes a final backup. | [postgres-service.md](postgres-service.md) |
| 30 | Observability is compose-only, loopback-bound, and exposed through tailnet Caddy vhosts. | [observability-service.md](observability-service.md) |
| 31 | Workers call sibling Workers through service bindings, never peer URLs. | [cloudflare-workers.md](cloudflare-workers.md) |
| 32 | PlanetScale Postgres reaches Workers only through Hyperdrive; credentials stay in Terraform state. | [cloudflare-workers.md](cloudflare-workers.md) |
| 33 | `worker-configuration.d.ts` is generated from the same Wrangler document used for deploy and committed. | [cloudflare-workers.md](cloudflare-workers.md) |
| 34 | Workers Logs are enabled by default and opt-out per Worker with `observability = false`. | [cloudflare-workers.md](cloudflare-workers.md) |

## Domain-specific guides

- [cron-service.md](cron-service.md) — `[[deploy.cron]]` scheduled jobs.
- [pipeline.md](pipeline.md) — full quality/deploy pipeline and configurable
  `DEV_WORKFLOW_FILE` (default `deploy-dev.yml`).
- [deploy-env.md](deploy-env.md) — the build door and runtime secret door.
- [hetzner-caller.md](hetzner-caller.md) — required Dockerfile, TOML, and caller
  workflow shape.
