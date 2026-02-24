---
name: nextnode-infra
description: NextNode infrastructure operations — CLI commands, Terraform, VPS provisioning, deployment, and DNS/SSL. For repo compliance and nextnode.toml config, see the `nextnode` skill.
user-invocable: true
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# NextNode Infrastructure Reference

> **`nextnode.toml` configuration** is documented in the `nextnode` skill (auto-loaded on all NextNode repos). This skill focuses on infrastructure operations.

## SSH Access

> **MANDATORY — both rules are non-negotiable:**
> 1. **User:** always `deploy`. Never `root` or any other user.
> 2. **Key:** always `~/.ssh/nextnode-ci` (`-i ~/.ssh/nextnode-ci`). Never the default SSH key or any other identity file.
>
> Example: `ssh -i ~/.ssh/nextnode-ci deploy@<host>`

## Tailscale

> **MANDATORY:** All `tailscale` CLI commands (e.g. `tailscale status`, `tailscale ssh`) MUST run outside the sandbox (`dangerouslyDisableSandbox: true`) because Tailscale communicates via a Unix socket that the sandbox blocks.

## Architecture Overview

NextNode uses a **config-as-code driven, zero-manual-UI** infrastructure:

- **GitHub Actions** — CI/CD orchestration with a single reusable workflow
- **`infra` CLI** (TypeScript, citty) — CI/CD engine in `packages/cli/` — provision, deploy, destroy, rollback, build, lint, test, publish
- **Terraform 1.9** (TF Cloud backend) — VPS provisioning (Hetzner); DNS managed by CLI via Cloudflare API
- **Docker Compose** — app deployment on each VPS
- **Caddy** — native reverse proxy (xcaddy + Cloudflare DNS, Sablier, certmagic-s3 plugins), SSL via ACME DNS-01 (HTTP-01 fallback), R2-backed cert storage
- **Sablier** — idle container auto-stop for non-prod environments (custom NextNode waiting page)
- **Tailscale** — secure internal mesh network (all VPSes connected)

**Repository:** `NextNodeSolutions/infrastructure`

> **`nn` CLI** (`packages/nn/`) is documented in the dedicated `nn` skill. See that skill for commands, libraries, env pipeline, and `[secrets]` config.

## CLI Commands

The `infra` CLI (`packages/cli/`) is built with **citty**. All commands accept `--config <path>` and `--env <env>` base args.

| Command | Purpose | Key Args |
|---------|---------|----------|
| `infra plan` | Show resolved config and planned pipeline actions (dry run) | `--ci`, `--pr-number` |
| `infra lint` | Run `pnpm <lint-script>` | — |
| `infra test` | Run `pnpm <test-script>` | — |
| `infra build` | Build Docker image(s), push to ghcr.io | `--sha`, `--list`, `--service` |
| `infra provision` | Provision VPS via Terraform (skips if VPS healthy) | `--force`, `--plan-only` |
| `infra deploy` | Deploy app to VPS via SSH + Docker Compose (maintenance-page default, blue-green optional) | `--sha`, `--resume` |
| `infra dns upsert` | Create/update DNS A record (+ wildcards) | `--ip` |
| `infra dns delete` | Delete DNS records for app | — |
| `infra dns list` | List DNS records for domain | — |
| `infra destroy` | Destroy VPS + cleanup (smart shared VPS handling) | `--app`, `--yes`, `--cleanup-workspace`, `--include-orphans` |
| `infra rollback` | Rollback to a previous git ref | `--ref`, `--skip-build`, `--yes`, `--confirm-prod` |
| `infra status` | Check VPS, containers, DNS, Caddy health | `--json` |
| `infra pipeline` | Run full CI/CD pipeline (provision + DNS + deploy) | `--sha`, `--force`, `--skip-quality`, `--force-shared-vps`, `--pr-number` |
| `infra publish` | Publish npm package (release or canary) | — |
| `infra validate` | Validate nextnode.toml port consistency | — |
| `infra services` | Service setup subcommands (R2, Supabase, Redis) | — |
| `infra setup-r2` | Bootstrap R2 credentials for Caddy cert storage | `--force` |
| `infra preview-cleanup` | Clean up orphaned PR preview deployments | `--pr`, `--repo`, `--dry-run` |

### CLI Libraries (`packages/cli/src/lib/`)

| Library | Key Functions |
|---------|---------------|
| **env-resolve** | `validateEnv(input): CanonicalEnv` (Phase 1: pure table lookup), `resolveEnv(canonical, config, prNumber?): ResolvedEnv` (Phase 2: full resolution). Returns `ResolvedEnv` with `identity` (canonical, short, isProduction, isPrPreview, effectiveId), `behavior` (proxied, supportsBlueGreen, basicAuthEligible, sablierEnabled, portRangeBase, domainPrefix), `compute` (domain, hostPort, greenPort, dbHostPort, studioHostPort, routeHostPort, routeGreenPort, workspace, imageTag, routeDomain, redirectDomains). **SINGLE SOURCE OF TRUTH for all env logic.** |
| **config** | `loadConfig()`, `parseConfig()`, `mergeConfig()`, `validateConfig()`, `resolveConfigInput()`, `findDefaultTomlPath()`, `detectDockerConfig()`, `computeWildcardDomain()` — env-specific compute functions moved to `ResolvedEnv.compute.*` |
| **compose** | `parseComposeEnv()`, `extractComposeEnvValues()`, `parseComposeContainerNames()` — env var extraction from compose files |
| **compose-parse** | `parseComposeServices(content): ComposeService[]`, `discoverBuildableServices(content, appDir): BuildableService[]` — YAML AST parser (`yaml` package) for service discovery, Dockerfile validation. Types: `ComposeService`, `BuildableService` |
| **compose-transform** | `transformCompose(content, options?: TransformOptions): string`, `stripSharedServices(content): StripResult`, `sanitizeServiceEnvName(name): string` — AST-based compose transformation: replaces `build:` with `image: ${IMAGE_<SERVICE>}`, strips NODE_ENV/deploy blocks. Types: `TransformOptions`, `StripResult` |
| **yaml-utils** | `injectService(doc, name, config)`, `removeService(doc, name)`, `injectNetwork(doc, serviceName, networkName, networkConfig?, aliases?)`, `injectLabels(doc, serviceName, labels)`, `injectDependsOn(doc, serviceName, dependency)`, `removeDependsOnEntry(doc, serviceName, dependency)`, `getServiceNames(doc): string[]`, `hasService(doc, name): boolean` — low-level YAML AST utilities for compose document manipulation (uses `yaml` package `Document` type). Exports `ServiceConfig` interface for compose service definitions. |
| **caddy-builder** | `CaddyfileBuilder` class — fluent builder for Caddy site blocks. Types: `CaddyCredential`, `CaddyTlsOptions`, `CaddySablierConfig` |
| **docker-build** | `buildImages(services, options): Promise<BuildResult[]>`, `pushImages(results): Promise<void>`, `listBuildableServices(content, appDir): BuildableService[]`, `imageTagForService(prefix, env, sha, service): string` — multi-service parallel build/push orchestration via `Promise.allSettled()`. Types: `BuildOptions`, `BuildResult` |
| **cloudflare** | `lookupZoneId()`, `upsertDnsRecord()`, `deleteDnsRecord()`, `listDnsRecords()`, `resolveCloudflareAccountId()`, `enableR2PublicAccess()`, `getR2BucketPublicUrl()`, `ensureR2PublicAccess()` — with retry for rate limiting; R2 public access automation via Cloudflare API |
| **dns** | `resolveDnsTarget()`, `resolveProxied()`, `resolveTtl()`, `upsertWildcardRecords()`, `upsertDevWildcardRecord()`, `upsertRedirectDnsRecords()`, `deleteRedirectDnsRecords()`, `upsertStudioDnsRecord()`, `deleteStudioDnsRecord()`, `upsertCdnDnsRecords()`, `deleteCdnDnsRecords()`, `extractRootDomain()` — CDN CNAME records for R2 custom domains (prod=proxied, dev=unproxied) |
| **ssh** | `sshExec()`, `scp()`, `withSshKey()`, `writeKeyFile()`, `cleanupKeyFile()` — SSH via Tailscale hostnames |
| **terraform** | `terraformInit()`, `terraformPlan()`, `terraformApply()`, `terraformOutput()`, `terraformDestroy()`, `terraformStateList()`, `terraformDestroyTargeted()`, `resetTerraformCheck()` |
| **tfcloud** | `getWorkspace()`, `ensureWorkspace()`, `deleteWorkspace()`, `hasResources()` |
| **tailscale** | `deleteDevice()`, `generateAuthKey()`, `getDeviceIp()`, `resetTokenCache()` — OAuth token caching |
| **caddy** | `generateHandleBlock()`, `generateBasicAuthBlock()`, `generateMaintenanceBlock()`, `generateCaddyFileContent()`, `generateRedirectBlock()`, `updateCaddyFile()`, `updateRedirectBlockInFile()`, `removeRedirectBlock()`, `deployCaddyConfig()`, `batchDeployCaddyConfigs()`, `removeCaddyBlock()`, `removeCaddyAppConfig()`, `switchToReverseProxy()`, `switchToMaintenance()`, `writeCaddyConfigAtomic()`, `restoreCaddyBackup()`, `reloadCaddy()`, `waitForCaddy()`, `sanitizeAppIdentifier()`, `SablierCaddyConfig`. Internal access enforced via DNS-level isolation (DNS → Tailscale IP), not Caddy guards. |
| **caddy-lifecycle** | `createCaddyLifecycle()` — strategy pattern: `RealCaddyLifecycle` (domain) / `NoOpCaddyLifecycle` (no domain). Interface: `showMaintenance()`, `restoreProxy()`, `switchTraffic()` |
| **compose-validation** | `validateCompose()` — check docker-compose.yml for common issues |
| **port-validation** | `validatePortConsistency()`, `validateDockerfile()`, `validateComposePort()`, `validateFrameworkConfig()` |
| **docker** | `dockerBuild()`, `dockerPush()`, `dockerLogin()` |
| **dockerfile** | `parseDockerfileEnv()` — extract ARG/ENV declarations from Dockerfile. `INFRA_MANAGED_VARS` constant excludes infra-managed env vars (NODE_ENV, PORT, APP_PORT_*, HOST_PORT_*, IMAGE_*, COMPOSE_PROJECT_NAME) |
| **github** | `ghFetch()`, `verifyCiPassed()`, `getCheckRuns()`, `getCommitStatus()`, `getWorkflowRun()`, `ensureGitHubEnvironments()`, `findOpenPrForCurrentBranch()` — prod gate CI verification + env sync |
| **hetzner** | `fetchHetznerSshKeyIds()` |
| **services** | `computeServiceEnvVars()`, `generateSupabaseKeys()`, `resolveCloudflareAccountId()`, `storeSupabaseKeysViaGh()`, `computeCdnEntryForEnv()`, `computeAllCdnDomains()` — derives env vars from `[services]` config: Supabase (URLs, JWT keys, POSTGRES_PASSWORD, DATABASE_HOST/PORT, OAuth vars), Redis (URL), R2 (per-env bucket name, account ID, endpoint, CDN URL with priority chain: domain_cdn > cdn[0] > R2 public URL, forwards credentials from process.env) |
| **supabase** | `generateSupabaseCompose()`, `mergeSupabaseCompose()`, `hasExistingSupabaseServices()`, `generateKongConfig()`, `generateInitScripts()`, `computeOAuthEnvVars()`, `resolvePostgresPassword()`, `SUPABASE_DEFAULT_VERSIONS` — centralized Supabase compose scaffolding + Kong API gateway config + init scripts + OAuth env vars |
| **r2** | `ensureR2Setup()`, `ensureR2Bucket()`, `ensureR2Credentials()` — self-healing R2 setup for Caddy cert storage. Auto-creates bucket + credentials, injects into `process.env`, best-effort stores as GitHub org secrets |
| **http** | `fetchWithRetry()` — generic fetch with exponential backoff on 429 |
| **polling** | `pollUntilReady()` — generic retry/polling (SSH wait, Tailscale wait, Caddy wait) |
| **exec** | `exec()`, `execCapture()`, `checkBinary()`, `requireBinary()` — process execution with secret redaction |
| **logger** | `logger` (consola), `withTiming()` |
| **secrets** | `validateSecrets()`, `requireEnv()`, `resolveHetznerToken(project?)` — per-project Hetzner token support |
| **constants** | `TF_CLOUD_ORG`, `TAILNET`, `TERRAFORM_DIR`, `GITHUB_ORG`, `R2_BUCKET_NAME`, `CLOUDFLARE_API`, secret group constants |
| **service-env** | `computeServiceBuildEnv(config, envShort, isProduction, dockerfileArgs, resolvedEnv?)` — demand-driven build arg computation. Provider pattern: only computes vars that Dockerfile ARGs actually reference. Per-service providers: `computeR2Vars()` / `R2_COMPUTABLE_VARS`, `computeRedisVars()` / `REDIS_COMPUTABLE_VARS`, `computeSupabaseVars()` / `SUPABASE_COMPUTABLE_VARS` |
| **supabase-deploy** | `ensureDevSupabase(params: EnsureDevSupabaseParams)`, `generateSupabaseDotEnv(composeName, supabaseVars)` — standalone idempotent Supabase deployer (internal module, not a CLI command). Used by dev deploys and PR previews to ensure the dev Supabase stack is running before the app deploy. |
| **maintenance-page** | `MAINTENANCE_PAGE_HTML` — static HTML for maintenance mode (503, auto-refresh) |
| **base-args** | `baseArgs` — shared `--config` and `--env` args for all commands |

### Key Config Types (`packages/cli/src/types/`)

```typescript
type ProjectType = "app" | "package"
type HealthType = "http" | "tcp"
type PipelineAction = "ci" | "deploy-prod" | "destroy" | "force-redeploy" | "pr-preview" | "pr-cleanup"
type SupabaseFeature = "storage" | "realtime"
type GenerateAlgorithm = "hex" | "base64url" | "uuid"

/** Discriminated union — bytes required for hex/base64url, absent for uuid. */
type SecretDeclaration =
  | { generate: "hex"; bytes: number }
  | { generate: "base64url"; bytes: number }
  | { generate: "uuid" }

interface ResourcesConfig {
  cpu_limit?: string       // e.g. "1.0"
  memory_limit?: string    // e.g. "1G", "256M"
  cpu_reservation?: string
  memory_reservation?: string
}

interface EnvironmentEntry extends ResourcesConfig {
  enabled: boolean
  pr_previews: boolean     // PR preview deployments. Forced false when enabled=false.
}

interface SupabaseOAuthProviderConfig { scopes?: string[] }
interface SupabaseOAuthConfig { providers: string[]; [provider: string]: string[] | SupabaseOAuthProviderConfig | undefined }
interface SupabaseVersionOverrides { postgres?; gotrue?; postgrest?; kong?; meta?; studio?; storage?; realtime? }
interface SupabaseServiceConfig { studio_port?: number; migrations?: string; features?: SupabaseFeature[]; oauth?: SupabaseOAuthConfig; versions?: SupabaseVersionOverrides }
interface R2ServiceConfig { bucket: string; public?: boolean; domain_cdn?: boolean; domain_cdn_prefix?: string; cdn?: string[] }
interface RedisServiceConfig { port?: number }
interface ServicesSection { supabase?: SupabaseServiceConfig; r2?: R2ServiceConfig; redis?: RedisServiceConfig }

/** Subdomain route mapping to a docker-compose service. */
interface RouteConfig {
  subdomain: string      // DNS label (e.g., "admin" → admin.domain.fr)
  service: string        // docker-compose service name
  port: number           // container port (1-65535)
  health_path?: string   // override health check path (default: main app's health.path)
}

interface ProjectConfig {
  project: { name: string; type: ProjectType; domain?: string; description?: string; redirect_domains?: string[] }
  scripts: { lint?: string | false; test?: string | false; build?: string | false }
  server?: { name?: string; project?: string; type: string; location: string; internal: boolean }
  volume: { enabled: boolean; size: number }
  deploy: { port: number; file?: string; hasCompose: boolean; zero_downtime: boolean }
  health: { type: HealthType; path?: string; interval: string; timeout: string; retries: number }
  environment: { development: EnvironmentEntry; production: EnvironmentEntry }
  sablier?: { enabled: boolean; session_duration: string; display_name: string }
  services?: ServicesSection
  routes?: RouteConfig[]  // [[routes]] — subdomain-to-service mappings (apps only)
  secrets?: Readonly<Record<string, SecretDeclaration>>  // auto-generated app-level secrets (nn up)
  computed: {
    isSharedVps: boolean
    wildcardDomain: string
    developmentEnabled: boolean   // shorthand for environment.development.enabled
    prPreviewsEnabled: boolean    // shorthand for environment.development.pr_previews && enabled
  }
}
```

### Environment Resolution Types (`packages/cli/src/types/env.ts`)

```typescript
type CanonicalEnv = "development" | "production"

interface EnvIdentity {
  canonical: CanonicalEnv
  short: string          // "dev" | "prod"
  github: string         // "development" | "production"
  effectiveId: string    // canonical or "pr-{N}" for PR previews
  isProduction: boolean
  isPrPreview: boolean
  prNumber: number | null
}

interface EnvBehavior {
  proxied: boolean           // true for prod (Cloudflare orange cloud)
  supportsBlueGreen: boolean // true for prod when zero_downtime enabled
  basicAuthEligible: boolean // true for non-prod
  sablierEnabled: boolean    // true for dev/PR when sablier configured
  portRangeBase: number      // 10000 (prod), 30000 (dev), 40000 (PR)
  domainPrefix: string | null // null (prod), "dev" (dev), "pr-{N}" (PR)
}

interface EnvCompute {
  domain(baseDomain: string): string           // prod: baseDomain, dev: dev.baseDomain, PR: pr-N.dev.baseDomain
  hostPort(appName: string): number            // portRangeBase + deterministicHash(appName)
  greenPort(appName: string): number           // 20000 + deterministicHash(appName-green)
  dbHostPort(appName: string): number          // Supabase Postgres host port
  studioHostPort(appName: string, override?): number // Supabase Studio host port
  routeHostPort(appName: string, subdomain: string): number  // per-route port
  routeGreenPort(appName: string, subdomain: string): number // per-route green port
  workspace(projectName: string, isShared: boolean, serverName?: string): string
  imageTag(projectName: string, sha: string, org?: string): string
  routeDomain(subdomain: string, baseDomain: string): string
  redirectDomains(baseDomain: string, rawRedirectDomains?: string[]): string[] // prod-only, auto-www
}

interface ResolvedEnv {
  identity: EnvIdentity
  behavior: EnvBehavior
  compute: EnvCompute
}
```

### Deploy Types (`packages/cli/src/types/deploy.ts` + `commands/deploy.ts`)

```typescript
type DeploySlot = "blue" | "green"
type DeployCheckpoint = "init" | "pull" | "compose-up" | "caddy-config" | "caddy-reload" | "health-check" | "cleanup" | "done"

interface DeployResult {
  imageTag: string; vpsHost: string; domain: string
  hostPort: number; healthStatus: "healthy" | "unhealthy"; duration: number
}

interface DeployState { activeSlot: DeploySlot; imageTag: string; deployedAt: string }

interface DeployOptions {
  env: string; sha: string; config: string
  devPreviewPassword?: string; devPassword?: string; resume?: boolean; prNumber?: number
}

interface CaddySiteConfig {
  appIdentifier: string; envDomain: string; wildcardDomain: string; baseDomain: string
  hostPort: number; isProduction: boolean; devPreviewPassword?: string; devPassword?: string
  mode?: "proxy" | "maintenance"
  sablier?: { group: string; sessionDuration: string; displayName: string }
  redirectDomains?: string[]; canonicalDomain?: string
  // Note: `internal` field was removed — internal access is now enforced via DNS-level isolation
}
```

### Pipeline Types (`packages/cli/src/types/pipeline.ts`)

```typescript
interface PipelinePlan {
  projectName: string; projectType: ProjectType; environment: string
  hasLint: boolean; hasTest: boolean; hasBuild: boolean; hasCompose: boolean
  needsProvision: boolean; imageTag: string; domain: string
}

interface PipelineStepResult { step: string; status: "success"|"skipped"|"failed"; duration: number; error?: string }
interface QualityResult { lint: PipelineStepResult; test: PipelineStepResult; build: PipelineStepResult; compose?: PipelineStepResult; portValidate?: PipelineStepResult; allPassed: boolean }
interface PipelineResult { plan: PipelinePlan; quality?: QualityResult; steps: PipelineStepResult[]; success: boolean; totalDuration: number }
```

### Status Types (`packages/cli/src/types/status.ts`)

```typescript
interface VpsStatus { hostname: string; publicIp: string; tailscaleIp: string; serverType: string; location: string; uptime: string; exists: boolean }
interface ContainerStatus { name: string; status: string; health: string; ports: string }
interface DnsStatus { name: string; type: string; content: string; proxied: boolean }
interface AppStatus { vps: VpsStatus; containers: ContainerStatus[]; dns: DnsStatus | null; caddy: CaddyStatus | null; image: ImageStatus | null; domain: DomainStatus | null }
```

## Pipeline Behavior

### What Happens on PR

| Project Type | Actions |
|-------------|---------|
| **Package** | Lint -> Test -> Build (no publish) |
| **Package + canary label** | Lint -> Test -> Build -> Canary publish (`0.0.0-canary.<sha>`) |
| **App** | Lint -> Test -> Build |
| **App (pr-preview)** | Lint -> Test -> Build -> Provision -> DNS -> Deploy (PR preview at `pr-{N}.dev.{domain}`) -> PR Comment |
| **App (pr-cleanup)** | Scan VPS for closed PR previews -> Remove containers, dirs, Caddy config -> Mark GH deployments inactive |

### What Happens on Merge to Main

| Project Type | Actions |
|-------------|---------|
| **Package** | Lint -> Test -> Build -> publish (npm + GitHub Release) |
| **App** | Lint -> Test -> Build -> Provision -> DNS -> Deploy dev -> [Prod gate] -> Deploy prod |

### Workflow Architecture

```
deploy-dev.yml (per-repo app template — see `nextnode` skill)
  └─> pipeline.yml (reusable workflow_call, in infrastructure repo)
        ├─> Plan job (TOML parse, outputs project_type/has_lint/test/build/buildable_services)
        ├─> Quality job (dynamic matrix: lint/test/build as configured)
        ├─> Build job (dynamic matrix: `infra build --list` discovers services, one matrix slot per service)
        ├─> Service Setup job (parallel matrix: R2/Cloudflare provisioning per setupable service)
        ├─> [For packages] pipeline-package.yml
        │     └─> publish (pnpm dlx semantic-release, monorepo-aware)
        └─> [For apps] After quality gates:
              ├─> Provision (infra provision, + GitHub App token, + R2 setup)
              ├─> DNS (infra dns upsert --ip, CDN CNAMEs, redirect records)
              ├─> Deploy (infra deploy --sha, via Tailscale VPN)
              ├─> [PR preview] PR Comment (upsert preview URL, create GH Deployment)
              ├─> [PR cleanup] preview-cleanup (scan + remove closed PR previews, mark GH deployments inactive)
              └─> Prod gate: verify 3/3 CI checks passed via GitHub Checks API

nn-pipeline.yml (reusable workflow_call — NN CLI package pipeline: quality gates + publish)

pipeline-package.yml (reusable workflow_call — monorepo-aware package pipeline):
  inputs: config_file, package_dir
  jobs: plan → lint → test → build → publish (semantic-release, monorepo plugin when package_dir != ".")
  outputs: publish_status, published_version

destroy-vps.yml (workflow_dispatch — manual VPS destruction):
  inputs: mode (named|shared), names, environment, cleanup_workspace, confirm_prod
  jobs: validate → destroy (matrix over workspaces) → TF destroy + Tailscale cleanup

Templates (in templates/):
  deploy-dev.yml — app dev deploy caller (push to main + manual)
  ci-package.yml — package CI caller
  preview-cleanup.yml — daily cron for orphaned PR preview cleanup
```

### How Workflows Invoke the CLI

Workflows check out the infra repo to `.infra/` with sparse-checkout (`packages/cli`, `nextnode.default.toml`, `terraform`), then invoke:

```bash
cd .infra && node packages/cli/dist/index.js <command> \
  --env "$ENV" --sha "${{ github.sha }}" \
  --config "../${{ inputs.config_file }}"
```

## .env Injection

At deploy time, the CLI builds the `.env` file for each app:

1. **All GitHub org secrets** are injected automatically, **except** infrastructure secrets (`HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `TF_CLOUD_TOKEN`, `TAILSCALE_OAUTH_*`, `SSH_PRIVATE_KEY`, `NPM_TOKEN`, `GITHUB_TOKEN`)
2. **Auto-injected variables** (if not already present from secrets):

| Variable | Source |
|----------|--------|
| `IMAGE_APP` | GHCR image tag for the main app service (or `IMAGE_{SERVICE}` per buildable service) |
| `HOST_PORT_APP` | Deterministic hash-based port (10000-29999) for the main app (or `HOST_PORT_{SERVICE}` per buildable service) |
| `APP_PORT_APP` | `[deploy].port` (default `4321`) for the main app (or `APP_PORT_{SERVICE}` per buildable service) |
| `NODE_ENV` | `production` for prod, `development` for others |
| `DOMAIN` | `[project].domain`, or VPS IP if no domain set |
| `PUBLIC_SITE_URL` | `https://<domain>`, or `http://<vps-ip>` if no domain set |
| `HOST_PORT_{SERVICE}` | Per-route host port (only when `[[routes]]` defined). SERVICE = uppercased service name, hyphens → underscores |
| `APP_PORT_{SERVICE}` | Per-route container port (only when `[[routes]]` defined) |

> **Breaking change (PR #71):** `IMAGE`, `HOST_PORT`, `APP_PORT` are now suffixed: `IMAGE_APP`, `HOST_PORT_APP`, `APP_PORT_APP`. Apps with custom `docker-compose.yml` must update their env var references. The `.env` is regenerated on every deploy — only the compose file in the app repo needs updating.

3. **Auto-detected compose env vars**: CLI reads the compose file and forwards any env vars referenced from `process.env`

## Terraform Structure

Located in `infrastructure/terraform/`:

```
terraform/
├── apps/          # Variable-driven app infrastructure (vps + volume composition)
├── modules/
│   ├── vps/       # Hetzner VPS: hcloud_server, hcloud_firewall, cloud-init
│   └── volume/    # Hetzner volume: hcloud_volume (ext4, automount, prevent_destroy)
└── global/        # Cloudflare zone-level settings (zones, DNSSEC, SSL mode) + R2 bucket
```

- **No DNS/SSL Terraform modules** — DNS records are managed by CLI via Cloudflare API
- **No environments/ dirs** — replaced by TF Cloud workspaces (variable-driven approach)
- **One `apps/` module** used by ALL apps — TF Cloud workspaces isolate state per app

### TF Cloud Workspaces

| Workspace | Contents |
|-----------|----------|
| `nextnode-shared-dev` | Shared dev VPS, Caddy (DNS managed by CLI) |
| `nextnode-shared-prod` | Shared prod VPS, Caddy (DNS managed by CLI) |
| `nextnode-<app>` | Per-app dedicated VPS + volume (DNS managed by CLI) |

Workspaces are auto-created by CLI (`ensureWorkspace()`). No manual bootstrap needed.

## VPS Setup (cloud-init)

Every VPS is provisioned with **Debian 12** and auto-configured via `templates/cloud-init.yml`. Install scripts are base64-embedded in `templates/scripts/`.

- **Docker** + docker-compose-plugin + buildx-plugin
- **Caddy** (xcaddy with `cloudflare`, `sablier-caddy-plugin`, `certmagic-s3` plugins) — R2-backed cert storage, DNS-01 ACME
- **Tailscale** (ephemeral auth key, auto-joins tailnet)
- **Sablier** v1.9.0 (idle container auto-stop, custom NextNode waiting page, connected to `caddy-net`)
- **fail2ban** for SSH protection (5 retries, 1h ban)
- **deploy** user (docker + sudo groups, passwordless sudo)
- **UFW** firewall (allow 80/443/Tailscale UDP, SSH only via `tailscale0`)
- **Automatic security updates** (unattended-upgrades)
- **Volume support** — wait-for-volume.sh polls for Hetzner volume mount, creates `/mnt/data` symlink

## Deployment Flow (App)

```
GitHub Actions triggers CLI pipeline (infra pipeline --sha <sha>)
  -> Load and validate nextnode.toml (smol-toml + defu merge with defaults)
  -> Resolve server tier (shared vs dedicated)
  -> QUALITY GATE: lint, test, build, compose-validate, port-validate (parallel, unless --skip-quality)
  -> PROD GATE (prod only): verify 3/3 CI checks passed via GitHub Checks API
  -> PROVISION:
     -> Ensure TF Cloud workspace exists
     -> Fetch Hetzner SSH key IDs
     -> Generate ephemeral Tailscale auth key
     -> Ensure R2 setup (bucket + credentials for Caddy cert storage)
     -> terraform plan → apply (skip if VPS exists and healthy)
     -> Wait for SSH via Tailscale hostname
     -> Get Tailscale IP
  -> DNS:
     -> If no domain: skip (CaddyLifecycle uses NoOp)
     -> Upsert A record (+ wildcard records)
     -> Upsert redirect domain DNS records (prod only, auto-www)
     -> Upsert CDN CNAME records for R2 custom domains (if `[services.r2]` with `domain_cdn` or `cdn` entries)
     -> Prod: proxied (orange cloud), Non-prod: unproxied (grey cloud)
     -> CNAME conflict detection and cleanup
  -> DEPLOY:
     -> Acquire deploy lock (5min timeout, prevents concurrent deploys)
     -> Check VPS resources (disk/memory warnings, abort if critical)
     -> Show maintenance page (default strategy) or prepare blue-green slot
     -> Create /opt/apps/<app> on VPS
     -> Transform compose (AST-based via `yaml` package): replace all build: blocks with image: ${IMAGE_<SERVICE>}, inject per-service ports
     -> Inject caddy-net into all services via `injectComposeNetworks()` (single unified owner)
     -> Generate .env (IMAGE_APP, HOST_PORT_APP, APP_PORT_APP per buildable service, NODE_ENV, secrets, service vars, route vars, auto-vars)
     -> Checkpoint-based deploy: init → pull → compose-up → caddy-config → caddy-reload → health-check → cleanup → done
     -> If zero_downtime: blue-green (two slots, health check inactive, atomic Caddy switch, 30s drain)
     -> Else: maintenance page → docker compose pull → up → switch to reverse proxy
     -> Atomic Caddy writes (backup + restore on failure)
     -> Persist deploy state (.deploy-state JSON on VPS: activeSlot, imageTag, deployedAt)
     -> Health checks (container + HTTP, includes per-route health checks)
     -> Deploy route Caddy configs (one handle block per route, inherits main app auth/sablier/internal)
     -> Clean up old Docker images
     -> Release deploy lock
     -> Resume support: --resume flag replays from last checkpoint on failure
```

### Smart Shared VPS Handling

The `infra destroy` command intelligently handles shared VPS:
- Checks if other apps are running on the shared VPS
- If other apps exist: removes only this app's containers, DNS, Caddy config (main + all routes) — keeps VPS alive
- If last app: full VPS destruction via Terraform destroy + Tailscale cleanup

## DNS & SSL Strategy

- **Cloudflare Universal SSL** — edge certs (free, auto-managed)
- **Caddy ACME** — origin certs via Let's Encrypt DNS-01 challenge (Cloudflare DNS plugin), HTTP-01 fallback, certs stored in Cloudflare R2 (`INTERNAL-caddy-certs` bucket via certmagic-s3)
- **Full (Strict) SSL mode** — origin cert validation required
- **Public apps** — orange cloud (Cloudflare proxied, CDN + DDoS protection)
- **Internal apps** — grey cloud (DNS points to Tailscale IP, DNS-level isolation — no Caddy guards needed)
- **DNS ownership**: CLI manages app DNS records via Cloudflare API. Terraform only manages zone-level settings (DNSSEC, SSL mode)
- **Cleanup**: `infra dns delete` removes A/CNAME records for an app domain (including CDN CNAME records)
- **Wildcard records**: `infra dns upsert` creates both `*.{domain}` and `{domain}` A records
- **Redirect domains**: `redirect_domains` config auto-creates DNS + Caddy redirect blocks (prod only, auto-adds www)
- **CDN CNAME records**: R2 CDN domains (`domain_cdn` + `cdn` array) get CNAME records pointing to R2 public bucket URL during pipeline DNS step. Prod = proxied (orange cloud), dev = unproxied. Idempotent — skips if record already exists with correct target. Cleaned up on destroy.
- **CNAME conflict detection**: auto-detects and deletes conflicting CNAME records before creating A records

## Dev Environment Auth

Non-prod deployments can be protected with Caddy basic auth via org-level GitHub secrets:

| Secret | User | Purpose |
|--------|------|---------|
| `DEV_PREVIEW_PASSWORD` | `preview` | Share with clients for preview access |
| `DEV_PASSWORD` | `dev` | Internal team access |

- CLI's `deployCaddyConfig()` generates bcrypt hashes on VPS using `caddy hash-password`
- Injects `basic_auth` block into Caddyfile for non-prod environments when domain is set and passwords are provided
- Graceful fallback: if passwords not set, deploys without auth

## GitHub Org Secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm package publishing |
| `HETZNER_API_TOKEN` | VPS provisioning |
| `CLOUDFLARE_API_TOKEN` | DNS/SSL management |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (R2, API operations) |
| `TF_CLOUD_TOKEN` | Terraform Cloud API (workspace mgmt + state) |
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth — generates ephemeral auth keys for new VPSes |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Tailscale OAuth — paired with client ID |
| `SSH_PRIVATE_KEY` | SSH private key for deploy user |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key (Caddy cert storage) — auto-created by `setup-r2` |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key — auto-created by `setup-r2` |
| `NEXTNODE_APP_ID` | GitHub App ID — used for generating tokens with elevated permissions |
| `NEXTNODE_APP_PRIVATE_KEY` | GitHub App private key — paired with App ID |
| `DEV_PREVIEW_PASSWORD` | Optional — basic auth for `preview` user on non-prod environments |
| `DEV_PASSWORD` | Optional — basic auth for `dev` user on non-prod environments |

### Production Approval Gate

The `infra pipeline` command (for `deploy-prod` action) verifies that all 3 CI checks (Lint, Test, Build) passed on the commit SHA via GitHub Checks API before allowing production deployment.

## Service Environment Variables

The `[services]` config section auto-generates environment variables at deploy time:

| Service | Generated Vars | Notes |
|---------|---------------|-------|
| **Supabase** | `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_URL`, `JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`, `DATABASE_HOST`, `DATABASE_PORT`, `APP_NAME` | URLs derived from domain (omitted when no domain); JWT keys auto-generated + stored as GH env secrets; POSTGRES_PASSWORD auto-generated + stored as GH env secret; DATABASE_HOST always `supabase-db`; DATABASE_PORT always `5432` (internal container port); OAuth vars via `computeOAuthEnvVars()` |
| **Supabase OAuth** | `GOTRUE_EXTERNAL_{PROVIDER}_ENABLED`, `_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI`, `_SCOPE` | Per-provider env vars from `[services.supabase.oauth]` config. Requires `{PROVIDER}_CLIENT_ID` + `{PROVIDER}_CLIENT_SECRET` as GH secrets. |
| **Redis** | `REDIS_URL` | `redis://redis:{port}` (default port 6379) |
| **R2** | `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ENDPOINT_URL`, `R2_CDN_URL`, `R2_CDN_URLS`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Bucket is per-env: `{bucket}-{envShortId}` (e.g., `assets-dev`, `assets-prod`); account ID + endpoint from CF API; `R2_CDN_URL` via priority chain: domain_cdn > cdn[0] > R2 public URL; `R2_CDN_URLS` only if 2+ CDN domains; credentials forwarded from process.env (org secrets) |

## Supabase Compose Scaffolding

The `supabase.ts` library auto-generates a full Supabase stack as Docker Compose services:

**Baseline services** (always included): `supabase-db` (Postgres 15.8), `supabase-auth` (GoTrue), `supabase-rest` (PostgREST), `supabase-kong` (API gateway), `supabase-meta` (PG Meta), `supabase-studio`

**Feature-gated services**: `supabase-storage` (when `features = ["storage"]`), `supabase-realtime` (when `features = ["realtime"]`)

**Generated artifacts**: Kong declarative YAML, roles.sql, init-db.sh (migration runner), kong-entrypoint.sh (env var interpolation)

**Merge behavior**: `mergeSupabaseCompose()` injects Supabase services into existing app compose, adds `depends_on: supabase-kong` to the app service. Data volumes mount to `/mnt/data/{appName}-supabase-*`.

## Subdomain Routing (`[[routes]]`)

Maps subdomains to docker-compose services. Each route exposes a specific compose service on its own subdomain with automated Caddy config, port allocation, and health checks.

### Config

```toml
[[routes]]
subdomain = "admin"
service = "strapi"
port = 1337
health_path = "/_health"  # optional, defaults to main app's health.path
```

### Domain Patterns

| Environment | Pattern | Example |
|-------------|---------|---------|
| Prod | `{sub}.{domain}` | `admin.fleursdaujourdhui.fr` |
| Dev | `{sub}.dev.{domain}` | `admin.dev.fleursdaujourdhui.fr` |
| PR preview | `{sub}-pr-{N}.dev.{domain}` | `admin-pr-5.dev.fleursdaujourdhui.fr` |

- DNS: covered by existing `*.{domain}` (prod) and `*.dev.{domain}` (dev/PR) wildcards — no new DNS records needed
- TLS: prod routes use `*.{domain}` cert, dev/PR routes use `*.dev.{domain}` cert

### Compose Transformation

- All services with `build:` get `image: ${IMAGE_<SERVICE>}` injected (replacing the build block) and `ports: "${HOST_PORT_<SERVICE>}:${APP_PORT_<SERVICE>}"`
- Route services (non-buildable) get `ports: "${HOST_PORT_SERVICE}:${APP_PORT_SERVICE}"` injected
- Route services get `caddy-net` network injected
- Services without `build:` and not in routes are left untouched
- Image tag convention: `ghcr.io/{org}/{project}:{env}-{sha}-{service}` (per-service suffix)

### Caddy

- One handle block per route, placed in the correct site file:
  - Prod: `{domain}.caddy` (same as main app)
  - Dev/PR: `dev.{domain}.caddy` (same as PR previews)
- Routes inherit main app's `basic_auth` and Sablier config
- App identifier: `{sanitizedAppName}-{subdomain}` (e.g., `fleurs-daujourdhui-admin`)

### Deploy Functions

- `extractComposeServiceNames(content)` — parse service names from compose
- `validateRouteServices(routes, composeServiceNames)` — deploy-time validation
- `sanitizeServiceEnvName(serviceName)` — convert to env var suffix
- `injectComposeNetworks(content)` — unified caddy-net injection into ALL services (single owner, replaces scattered injection calls)
- `deployRouteCaddyConfigs(ctx, routes)` — deploy Caddy configs for all routes (uses `batchDeployCaddyConfigs()` for atomic multi-config deployment)

### Blue-Green

When `zero_downtime` is enabled, routes participate: each route gets blue/green ports, all handle blocks swap atomically in one Caddy reload.

### Destroy

`infra destroy` removes all route Caddy blocks from both `{domain}.caddy` and `dev.{domain}.caddy`.

## Auto-Generated Environment Variables (Do NOT Add Manually)

The infrastructure auto-generates and injects these variables at deploy time. **Projects must NEVER define these in GitHub secrets, `.env` files, or `docker-compose.yml` environment blocks.** They are overwritten on every deploy.

### Core Deploy Variables

Always injected by `generateDotEnv()` in `deploy.ts`:

| Variable | Value | Source |
|----------|-------|--------|
| `IMAGE_APP` | `ghcr.io/{org}/{repo}:{env}-{sha}-app` | Computed from config |
| `COMPOSE_PROJECT_NAME` | `{appName}-{env}[-{slot}]` | Computed from config |
| `HOST_PORT_APP` | Deterministic port (10000-29999) | Hash of app name |
| `APP_PORT_APP` | `[deploy].port` (default `4321`) | `nextnode.toml` |
| `NODE_ENV` | `production` or `development` | Derived from env |

### Multi-Service / Route Variables

Injected per buildable service and per `[[routes]]` entry:

| Variable | Pattern | Example |
|----------|---------|---------|
| `IMAGE_{SERVICE}` | Per buildable service | `IMAGE_STRAPI` |
| `HOST_PORT_{SERVICE}` | Per service/route host port | `HOST_PORT_ADMIN` |
| `APP_PORT_{SERVICE}` | Per service/route container port | `APP_PORT_API` |

SERVICE = uppercased service name, hyphens replaced with underscores.

### Supabase Service Variables

Injected when `[services.supabase]` is configured (`computeServiceEnvVars()` in `services.ts`):

| Variable | Value |
|----------|-------|
| `SITE_URL` | `https://{envDomain}` |
| `API_EXTERNAL_URL` | Same as `SITE_URL` |
| `SUPABASE_URL` | `http://supabase-kong:8000` |
| `JWT_SECRET` | 64-char hex (auto-generated, stored as GH env secret) |
| `SUPABASE_ANON_KEY` | JWT (auto-generated, stored as GH env secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT (auto-generated, stored as GH env secret) |
| `POSTGRES_PASSWORD` | 64-char hex (auto-generated, stored as GH env secret) |
| `POSTGRES_DB` | `postgres` |
| `POSTGRES_USER` | `supabase_admin` |
| `DATABASE_HOST` | `supabase-db` (always, Docker service name) |
| `DATABASE_PORT` | `5432` (internal Postgres container port for container-to-container access). Note: `dbHostPort()` in env-resolve is for Docker host port mapping only. |
| `APP_NAME` | `[project].name` from `nextnode.toml` |

### Supabase OAuth Variables

Injected per provider when `[services.supabase.oauth]` is configured (`computeOAuthEnvVars()` in `supabase.ts`):

| Variable | Example |
|----------|---------|
| `GOTRUE_EXTERNAL_{PROVIDER}_ENABLED` | `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` |
| `GOTRUE_EXTERNAL_{PROVIDER}_CLIENT_ID` | From `{PROVIDER}_CLIENT_ID` GH secret |
| `GOTRUE_EXTERNAL_{PROVIDER}_SECRET` | From `{PROVIDER}_CLIENT_SECRET` GH secret |
| `GOTRUE_EXTERNAL_{PROVIDER}_REDIRECT_URI` | `https://{domain}/auth/v1/callback` |
| `GOTRUE_EXTERNAL_{PROVIDER}_SCOPE` | From `[services.supabase.oauth.{provider}].scopes` |

Note: GitHub OAuth uses `GH_CLIENT_ID` / `GH_CLIENT_SECRET` (not `GITHUB_*`) to avoid GitHub's reserved namespace.

### Redis Service Variables

Injected when `[services.redis]` is configured:

| Variable | Value |
|----------|-------|
| `REDIS_URL` | `redis://redis:{port}` (default port 6379) |

### R2 Service Variables

Injected when `[services.r2]` is configured:

| Variable | Value |
|----------|-------|
| `R2_BUCKET_NAME` | Per-env: `{bucket}-{envShortId}` (e.g., `assets-dev`, `assets-prod`) |
| `R2_ACCOUNT_ID` | Resolved via Cloudflare API |
| `R2_ENDPOINT_URL` | `https://{accountId}.r2.cloudflarestorage.com` |
| `R2_CDN_URL` | Best available CDN URL (priority: `domain_cdn` auto-domain > `cdn[0]` > R2 public URL). Always `https://`. Not set if no CDN source available. |
| `R2_CDN_URLS` | Comma-separated `https://` URLs (only if 2+ CDN domains from `domain_cdn` + `cdn` combined) |
| `R2_ACCESS_KEY_ID` | Forwarded from org secret |
| `R2_SECRET_ACCESS_KEY` | Forwarded from org secret |

**R2 CDN URL resolution chain** (`computeAllCdnDomains()` + `computeServiceEnvVars()`):
1. `domain_cdn = true` → auto-derives `{prefix}.{domain}` (prod) or `{prefix}.{envId}.{domain}` (dev). Prefix defaults to `"cdn"`, overridable via `domain_cdn_prefix`.
2. `cdn` array entries → each bare hostname is env-prefixed for non-prod via `computeCdnEntryForEnv()` (e.g., `cdn.example.com` → `cdn.dev.example.com`).
3. Fallback: R2 public bucket URL from Cloudflare API (only if `public = true`).
4. `R2_CDN_URL` = `https://{first domain from above}`. `R2_CDN_URLS` = all domains joined (only if 2+).

### Infra-Managed Vars (`INFRA_MANAGED_VARS`)

These base names are recognized by the CLI as infra-managed and **excluded from Dockerfile/Compose env validation** (the CLI never asks for them as secrets):

```
NODE_ENV, PORT, APP_PORT, HOST_PORT, HOST, HOSTNAME, IMAGE, COMPOSE_PROJECT_NAME
```

Defined in `packages/cli/src/lib/dockerfile.ts`. Any `ENV` or compose variable matching these names is silently skipped during secret validation.

### Quick Reference: What to Add vs What NOT to Add

**DO add as GitHub secrets** (user-provided):
- App-specific API keys (`STRIPE_SECRET_KEY`, `SENTRY_AUTH_TOKEN`, etc.)
- OAuth client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.)
- Any custom app env var your code needs

**Do NOT add** (infra auto-generates these):
- `IMAGE_*`, `HOST_PORT_*`, `APP_PORT_*` — port and image mappings
- `NODE_ENV`, `COMPOSE_PROJECT_NAME` — deploy context
- `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_URL` — Supabase URLs
- `JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase keys
- `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`, `DATABASE_HOST`, `DATABASE_PORT` — Postgres credentials/connection
- `GOTRUE_EXTERNAL_*` — OAuth wiring
- `REDIS_URL` — Redis connection
- `R2_*` (including `R2_CDN_URL`, `R2_CDN_URLS`) — R2 storage config
- `APP_NAME` — derived from project name
