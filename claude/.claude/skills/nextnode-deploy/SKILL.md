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
synced-at: 55857e6
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
| `teardown` | deploy | Tear down provisioned infra (VPS + DNS, or Pages project + domains + R2) |
| `seo-guard` | deploy | Inject `_headers` + `robots.txt` into build output for non-prod envs |
| `prod-gate` | standalone | Verify dev pipeline passed before production deploy |
| `publish-result` | standalone | Parse semantic-release output, write status/version/summary |
| `compute-image-ref` | standalone | Normalize `GITHUB_REPOSITORY` + `GITHUB_SHA` into a GHCR image ref |
| `build-golden-image` | standalone | Build + snapshot a Hetzner golden image (Docker preinstalled), keyed by deterministic fingerprint, prunes old snapshots. Replaces Packer. See [golden-image.md](golden-image.md) |
| `recover` | standalone | Recover/rebuild VPS state from Hetzner labels when local state is lost |

Commands are registered in `index.ts` in three maps: `PLAN_COMMANDS`, `DEPLOY_COMMANDS`, `STANDALONE_COMMANDS`. Deploy commands receive a `DeployableConfig` and are skipped (logged "non-deployable project") for `type=package`.

## Folder structure

See [structure.md](structure.md) for the full annotated tree of `src/cli/`, `src/domain/`, `src/adapters/`, and `src/config/`. The strict layer import rules (domain pure, adapters never decide, CLI orchestrates) live in `packages/infrastructure/CLAUDE.md`.

## Config: nextnode.toml

See [config.md](config.md) for full schema, types, and env var reference.

## DeployTarget interface

Provider-agnostic abstraction in `domain/deploy/target.ts`:

```typescript
interface DeployTarget {
  readonly name: string

  // Contribute the env this target owns (always SITE_URL, plus target keys).
  // Returns a {public, secret} ServiceEnv shape. Sync OR async - Hetzner is
  // pure config arithmetic, Cloudflare looks up the live *.pages.dev
  // subdomain. Orchestrator merges with services + secrets via mergeServiceEnvs.
  contributeEnv(projectName: string): TargetEnv | Promise<TargetEnv>

  ensureInfra(projectName: string): Promise<ProvisionResult>
  reconcileDns(projectName: string, domain: string): Promise<void>

  deploy(
    projectName: string,
    input: DeployInput,
    env: DeployEnv,                 // already merged + narrowed (SITE_URL guaranteed)
  ): Promise<DeployResult>

  teardown(
    projectName: string,
    domain: string | undefined,
    target: TeardownTarget,         // 'infra' | 'dns' | 'all'
  ): Promise<TeardownResult>

  describe?(projectName: string): Promise<TargetState | null>
}

interface TargetEnv extends ServiceEnv {
  readonly public: Readonly<Record<string, string>> & {
    readonly SITE_URL: string         // required - every app needs it
  }
}

interface DeployEnv {
  readonly SITE_URL: string
  readonly [key: string]: string
}

interface DeployInput {
  readonly secrets: Readonly<Record<string, string>>
  readonly image?: ImageRef
  readonly registryToken?: string
}
```

Zero SSH/Docker/hcloud/Caddy leak in public types. `contributeEnv` returns `{public, secret}` so a target can claim env keys on the same channel as a backing service - both flow through `mergeServiceEnvs`, which throws on key collisions (no silent overwrites). `buildDeployEnv()` narrows the merged public Record into a `DeployEnv`, throwing if SITE_URL is missing (= a target skipped its `contributeEnv` obligation, which is a wiring bug).

Implemented targets: `CloudflarePagesTarget` (static sites) and `HetznerVpsTarget` (containerized apps). Multi-service compose is not supported yet (single `app` service hardcoded).

See [hetzner-vps.md](hetzner-vps.md) for the Hetzner VPS architecture deep-dive.

## Backing services

Pluggable per-service abstraction in `domain/services/`. Each service contributes a `{public, secret}` env block, just like a `DeployTarget` - they merge through the same primitive (`mergeServiceEnvs`) with collision detection. Today the only registered service is **R2** (Cloudflare object storage), declared per-project in `[services.r2] buckets = [...]`.

See [r2-service.md](r2-service.md) for R2 provisioning, naming, env vars, and the credential split (CF API token derives S3 keys via SHA256).

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

1. **Check the code, not assumptions** - only reference features that exist in source
2. **Callers choose their workflow by `type`** - `package` -> `publish-package.yml`, `app` -> `deploy.yml`, `static` -> `deploy-static.yml`
3. **One caller file per environment** - deploy workflows take `environment: development | production` input
4. **prod-gate lives in the quality matrix** - added as a task when `environment=production` AND `config.environment.development=true`
5. **`resolveDeployDomain` is the single source of truth** for dev subdomain convention - never inline `dev.{domain}`
6. **`[deploy].secrets` lists secret NAMES** - same name on GitHub and Cloudflare, no prefix transformation
7. **SITE_URL is always auto-computed** - every DeployTarget MUST put SITE_URL in `contributeEnv().public`. The orchestrator narrows the merged env via `buildDeployEnv()` and throws if it's missing - that means a target skipped its obligation, which is a wiring bug
8. **Correct GitHub triggers per project type** - `type=package`: `release: [published]`. `type=static` / `type=app`: `workflow_dispatch` for prod, `push: branches: [main]` for dev
9. **Single source of truth for all defaults** - every config default lives in `config/types.ts` as a named constant (`DEFAULT_HETZNER_CONFIG = { serverType: 'cx23', location: 'nbg1' }`, `DEFAULT_R2_STATE_BUCKET = 'nextnode-state'`, etc.). Validators import these constants - they never define their own inline defaults.
10. **No defaults for non-applicable concepts** - if a concept doesn't apply to a project type, there must be NO default for it
11. **DeployTarget hides provider details** - no SSH/Docker/hcloud/Caddy in public types. Adding a new provider = new adapter, zero CLI change
12. **SEO guard is infrastructure-level** - individual sites never handle their own noindex logic
13. **Backing services compose like targets** - every service contributes a `{public, secret}` `ServiceEnv`; targets and services merge through `mergeServiceEnvs`. Two services claiming the same env key throws (collision = bug, not silent overwrite). Add a new service: extend `SERVICE_NAMES` in `config/types.ts`, add its `ServiceConfigByName` entry, write a pure builder in `domain/services/<name>.ts`, register adapter wiring.
14. **Strict layer rules apply** - domain is 100% pure (no IO/env/logger), adapters never make business decisions, CLI orchestrates. See `packages/infrastructure/CLAUDE.md` for the full enforcement table.
15. **Golden images are fingerprinted, not versioned** - the builder hashes the relevant config (Docker version pin, base image SKU, init script) into a deterministic fingerprint, labels the snapshot, and reuses it. Bumping a pin invalidates the fingerprint and triggers a rebuild on next provision. Old snapshots are pruned to `MAX_GOLDEN_IMAGE_SNAPSHOTS`.
