---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure). Config
  parsing, CI quality gates, Cloudflare Pages deploy, Hetzner VPS deploy,
  SEO guard, prod gate, DeployTarget abstraction.
user-invocable: true
synced-at: 50e2bbd
---

# @nextnode-solutions/infrastructure

Config-driven CI/CD CLI for NextNode projects. Reads `nextnode.toml`, runs quality gates, deploys to Cloudflare Pages or Hetzner VPS, parses publish results, and enforces prod gates.

**Source**: `packages/infrastructure` in `@nextnode/core`
**Binary**: runs via `node src/index.ts <command>` (Node 24 native TS)

## Instructions

Always read the actual code before answering — start with `packages/infrastructure/src/` and `packages/infrastructure/CLAUDE.md`.

## CLI commands

| Command | Type | What it does |
|---------|------|-------------|
| `plan` | config | Parse `nextnode.toml`, output quality matrix + plan outputs |
| `provision` | deploy | Provision infrastructure (Pages project + domains, or Hetzner VPS) |
| `deploy` | deploy | Compute SITE_URL, sync env vars, deploy to target |
| `dns` | deploy | Reconcile Cloudflare DNS CNAME records |
| `seo-guard` | deploy | Inject `_headers` + `robots.txt` into build output for non-prod envs |
| `prod-gate` | standalone | Verify dev pipeline passed before production deploy |
| `publish-result` | standalone | Parse semantic-release output, write status/version/summary |
| `compute-image-ref` | standalone | Normalize `GITHUB_REPOSITORY` + `GITHUB_SHA` into a GHCR image ref, write to `GITHUB_OUTPUT` |

Commands are registered in `index.ts` in three maps: `PLAN_COMMANDS`, `DEPLOY_COMMANDS`, `STANDALONE_COMMANDS`. Deploy commands receive a `DeployableConfig` and are skipped for non-deployable projects.

## Folder structure

```
src/
  index.ts                          — Command registry + argv dispatch
  cli/
    env.ts                          — requireEnv, getEnv
    secrets.ts                      — parseAllSecrets, pickSecrets
    fixtures.ts                     — Test config fixtures
    deploy/
      create-target.ts              — Factory: config + env → DeployTarget
      deploy.command.ts             — computeDeployEnv + target.deploy()
      provision.command.ts          — target.ensureInfra() + step summary
      dns.command.ts                — target.reconcileDns()
      seo-guard.command.ts          — SEO guard injection
    r2/
      context.ts                    — R2Context type (CF creds + bucket names)
      ensure-setup.ts               — Full R2 bootstrap (provision)
      load-runtime.ts               — R2 credential verification (deploy)
      rotate-token.ts               — R2 token rotation + org secret sync
    pipeline/
      plan.command.ts               — Plan + quality matrix
      prod-gate.command.ts          — Dev pipeline check
      publish-result.command.ts     — SR output parsing
  domain/
    environment.ts                  — AppEnvironment, PipelineEnvironment
    deploy/
      target.ts                     — DeployTarget interface + types
      domain.ts                     — resolveDeployDomain
      env.ts                        — computeDeployEnv (SITE_URL)
      image-ref.ts                  — computeImageRef (GHCR ref)
      seo-guard.ts                  — computeSeoGuardFiles (pure)
      deploy-summary.ts             — buildDeploySummary (Markdown)
      provision-summary.ts          — buildProvisionSummary (Markdown)
    cloudflare/
      dns-records.ts                — computeDnsRecords (CNAME for Pages)
      pages-domains.ts              — computePagesDomains (pure)
      pages-project-name.ts         — computePagesProjectName (pure)
      r2/                           — R2 provisioning pure logic
    hetzner/
      caddy-config.ts               — buildCaddyConfig + buildInternalCaddyConfig
      caddy-for-project.ts          — buildCaddyForProject (routes by internal)
      cloud-init.ts                 — renderCloudInit (deploy user, UFW, tailscale)
      dns-records.ts                — computeVpsDnsRecords (A records, internal-aware)
      firewall-rules.ts             — computeFirewallRules (internal-aware)
      vector-config.ts              — selectVectorConfig (conditional Vector setup)
      compute-silo.ts               — Pure env silo computation
      compose-env.ts                — formatComposeEnv (KEY=val serializer)
    pipeline/
      prod-gate.ts                  — findDevRun, evaluateDevRun
      quality-matrix.ts             — buildQualityMatrix, hasProdGate
      publish-result.ts             — parseSemanticReleaseOutput
  adapters/
    cloudflare/                     — Pages project, domains, DNS, env vars
    hetzner/                        — Modular VPS adapter (see hetzner-vps.md)
      target.ts                     — HetznerVpsTarget (DeployTarget impl)
      ensure-infra.ts               — Provision orchestrator (fresh + resume)
      provision-vps.ts              — VPS creation + Tailscale + firewall
      converge-vps.ts               — Post-boot Caddy/Vector config sync via SSH
      deploy-container.ts           — Docker container deployment via SSH
      hcloud-client.ts              — Hetzner Cloud API wrapper
      hcloud-state.ts               — R2 state persistence with ETag locking
      ssh-session.ts                — SSH2 connection management
    r2/                             — R2 client (S3 SDK wrapper)
    github/                         — GitHub API, Actions outputs
    build-output/                   — inject-files (SEO guard)
  config/                           — nextnode.toml schema + loader
    validation/providers/           — Per-target validation (strategy)
```

## Config: nextnode.toml

See [config.md](config.md) for full schema, types, and env var reference.

## DeployTarget interface

Provider-agnostic abstraction in `domain/deploy/target.ts`:

```typescript
interface DeployTarget {
  readonly name: string
  computeDeployEnv(projectName: string): DeployEnv | Promise<DeployEnv>
  ensureInfra(projectName: string): Promise<ProvisionResult>
  reconcileDns(projectName: string, domain: string): Promise<void>
  deploy(projectName: string, input: DeployInput, env: DeployEnv): Promise<DeployResult>
  describe?(projectName: string): Promise<TargetState | null>
}

interface DeployInput {
  readonly secrets: Readonly<Record<string, string>>
  readonly image?: ImageRef
  readonly registryToken?: string
}
```

Zero SSH/Docker/hcloud/Caddy leak in public types. `computeDeployEnv` returns `T | Promise<T>` so sync impls (Hetzner) stay sync. Implemented targets: `CloudflarePagesTarget` (static sites) and `HetznerVpsTarget` (containerized apps). Multi-service compose is not supported yet.

See [hetzner-vps.md](hetzner-vps.md) for the Hetzner VPS architecture deep-dive.

## SEO guard

Prevents search engine indexing of non-production deploys. Runs after `pnpm build`, before Cloudflare Pages deploy.

- **Domain**: `computeSeoGuardFiles(environment)` — returns `_headers` (X-Robots-Tag: noindex) + `robots.txt` (Disallow: /) for non-prod, empty array for prod
- **Adapter**: `injectFiles(buildDirectory, files)` — writes files to build output
- **CLI**: `seoGuardCommand` — orchestrates domain + adapter, reads `BUILD_DIRECTORY` env var

## Prod gate

Configurable dev workflow path via `DEV_WORKFLOW_FILE` env var (default: `deploy-dev.yml`). Multi-app repos pass their custom filename (e.g. `landing-dev.yml`) through the workflow input `dev_workflow_file`.

See [pipeline.md](pipeline.md) for full pipeline architecture.

## Deploy env strategy

See [deploy-env.md](deploy-env.md) for SITE_URL computation and secrets flow.

## Kickstarting a new package

See [kickstart-package.md](kickstart-package.md) for the complete guide.

## Hetzner caller convention

See [hetzner-caller.md](hetzner-caller.md) for what a project repo must provide (minimal `docker-compose.yml`, `Dockerfile`, forbidden keys, caller workflow files).

## Usage (caller repos)

```yaml
# deploy-dev.yml (auto on push to main)
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: development
    secrets: inherit

# deploy-prod.yml (manual trigger)
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: production
    secrets: inherit

# Multi-app repo with custom workflow names
# landing-prod.yml
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: production
      dev_workflow_file: landing-dev.yml   # overrides default deploy-dev.yml
    secrets: inherit
```

## Rules

1. **Check the code, not assumptions** — only reference features that exist in source
2. **Callers choose their workflow by `type`** — `package` -> `publish-package.yml`, `app` -> `deploy.yml`, `static` -> `deploy-static.yml`
3. **One caller file per environment** — deploy workflows take `environment: development | production` input
4. **prod-gate lives in the quality matrix** — added as a task when `environment=production` AND `config.environment.development=true`
5. **`resolveDeployDomain` is the single source of truth** for dev subdomain convention — never inline `dev.{domain}`
6. **`[deploy].secrets` lists secret NAMES** — same name on GitHub and Cloudflare, no prefix transformation
7. **SITE_URL is always auto-computed** — from domain + environment, never manually set
8. **Correct GitHub triggers per project type** — `type=package`: `release: [published]`. `type=static` / `type=app`: `workflow_dispatch` for prod, `push: branches: [main]` for dev
9. **Single source of truth for all defaults** — every config default lives in `config/types.ts` as a named constant. Validators import these constants — they never define their own inline defaults.
10. **No defaults for non-applicable concepts** — if a concept doesn't apply to a project type, there must be NO default for it
11. **DeployTarget hides provider details** — no SSH/Docker/hcloud/Caddy in public types. Adding a new provider = new adapter, zero CLI change
12. **SEO guard is infrastructure-level** — individual sites never handle their own noindex logic
