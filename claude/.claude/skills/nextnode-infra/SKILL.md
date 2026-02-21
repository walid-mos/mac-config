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

## CLI Commands

The `infra` CLI (`packages/cli/`) is built with **citty**. All commands accept `--config <path>` and `--env <env>` base args.

| Command | Purpose | Key Args |
|---------|---------|----------|
| `infra plan` | Show resolved config and planned pipeline actions (dry run) | `--ci`, `--pr-number` |
| `infra lint` | Run `pnpm <lint-script>` | — |
| `infra test` | Run `pnpm <test-script>` | — |
| `infra build` | Build Docker image, push to ghcr.io | `--sha` |
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
| `infra setup-r2` | Bootstrap R2 credentials for Caddy cert storage | `--force` |
| `infra preview-cleanup` | Clean up orphaned PR preview deployments | `--pr`, `--repo`, `--dry-run` |

### CLI Libraries (`packages/cli/src/lib/`)

| Library | Key Functions |
|---------|---------------|
| **config** | `loadConfig()`, `parseConfig()`, `mergeConfig()`, `validateConfig()`, `resolveConfigInput()`, `computeHostPort()`, `computeGreenPort()`, `computeEnvDomain()`, `computeRouteEnvDomain()`, `computeWildcardDomain()`, `computeRedirectDomains()`, `computePreviewDomain()`, `computeWorkspaceName()`, `computeImageTag()`, `infraEnvId()`, `isPrPreview()`, `detectDockerConfig()`, `findDefaultTomlPath()` |
| **compose** | `parseComposeEnv()`, `extractComposeEnvValues()`, `parseComposeContainerNames()` — env var extraction from compose files |
| **cloudflare** | `lookupZoneId()`, `upsertDnsRecord()`, `deleteDnsRecord()`, `listDnsRecords()`, `resolveCloudflareAccountId()` — with retry for rate limiting |
| **dns** | `resolveDnsTarget()`, `resolveProxied()`, `resolveTtl()`, `upsertWildcardRecords()`, `upsertDevWildcardRecord()`, `upsertRedirectDnsRecords()`, `deleteRedirectDnsRecords()` |
| **ssh** | `sshExec()`, `scp()`, `withSshKey()`, `writeKeyFile()`, `cleanupKeyFile()` — SSH via Tailscale hostnames |
| **terraform** | `terraformInit()`, `terraformPlan()`, `terraformApply()`, `terraformOutput()`, `terraformDestroy()`, `terraformStateList()`, `terraformDestroyTargeted()`, `resetTerraformCheck()` |
| **tfcloud** | `getWorkspace()`, `ensureWorkspace()`, `deleteWorkspace()`, `hasResources()` |
| **tailscale** | `deleteDevice()`, `generateAuthKey()`, `getDeviceIp()`, `resetTokenCache()` — OAuth token caching |
| **caddy** | `generateHandleBlock()`, `generateBasicAuthBlock()`, `generateMaintenanceBlock()`, `generateCaddyFileContent()`, `generateRedirectBlock()`, `updateCaddyFile()`, `updateRedirectBlockInFile()`, `removeRedirectBlock()`, `deployCaddyConfig()`, `removeCaddyBlock()`, `removeCaddyAppConfig()`, `switchToReverseProxy()`, `switchToMaintenance()`, `writeCaddyConfigAtomic()`, `restoreCaddyBackup()`, `reloadCaddy()`, `waitForCaddy()`, `sanitizeAppIdentifier()`, `TAILSCALE_CGNAT_RANGE`, `SablierCaddyConfig` |
| **caddy-lifecycle** | `createCaddyLifecycle()` — strategy pattern: `RealCaddyLifecycle` (domain) / `NoOpCaddyLifecycle` (no domain). Interface: `showMaintenance()`, `restoreProxy()`, `switchTraffic()` |
| **compose-validation** | `validateCompose()` — check docker-compose.yml for common issues |
| **port-validation** | `validatePortConsistency()`, `validateDockerfile()`, `validateComposePort()`, `validateFrameworkConfig()` |
| **docker** | `dockerBuild()`, `dockerPush()`, `dockerLogin()` |
| **dockerfile** | `parseDockerfileEnv()` — extract ARG/ENV declarations from Dockerfile. `INFRA_MANAGED_VARS` constant excludes `NODE_ENV`, `PORT`, `APP_PORT`, `HOST_PORT`, `IMAGE`, `COMPOSE_PROJECT_NAME` |
| **github** | `ghFetch()`, `verifyCiPassed()`, `getCheckRuns()`, `getCommitStatus()`, `getWorkflowRun()`, `ensureGitHubEnvironments()`, `findOpenPrForCurrentBranch()` — prod gate CI verification + env sync |
| **hetzner** | `fetchHetznerSshKeyIds()` |
| **services** | `computeServiceEnvVars()`, `generateSupabaseKeys()`, `resolveCloudflareAccountId()`, `storeSupabaseKeysViaGh()` — derives env vars from `[services]` config: Supabase (URLs, JWT keys, POSTGRES_PASSWORD, OAuth vars), Redis (URL), R2 (account ID, endpoint, public URL, bucket name + forwards credentials from process.env) |
| **supabase** | `generateSupabaseCompose()`, `mergeSupabaseCompose()`, `hasExistingSupabaseServices()`, `generateKongConfig()`, `generateInitScripts()`, `computeOAuthEnvVars()`, `resolvePostgresPassword()`, `SUPABASE_DEFAULT_VERSIONS` — centralized Supabase compose scaffolding + Kong API gateway config + init scripts + OAuth env vars |
| **r2** | `ensureR2Setup()`, `ensureR2Bucket()`, `ensureR2Credentials()` — self-healing R2 setup for Caddy cert storage. Auto-creates bucket + credentials, injects into `process.env`, best-effort stores as GitHub org secrets |
| **http** | `fetchWithRetry()` — generic fetch with exponential backoff on 429 |
| **polling** | `pollUntilReady()` — generic retry/polling (SSH wait, Tailscale wait, Caddy wait) |
| **exec** | `exec()`, `execCapture()`, `checkBinary()`, `requireBinary()` — process execution with secret redaction |
| **logger** | `logger` (consola), `withTiming()` |
| **secrets** | `validateSecrets()`, `requireEnv()`, `resolveHetznerToken(project?)` — per-project Hetzner token support |
| **constants** | `TF_CLOUD_ORG`, `TAILNET`, `TERRAFORM_DIR`, `GITHUB_ORG`, `R2_BUCKET_NAME`, `CLOUDFLARE_API`, secret group constants |
| **maintenance-page** | `MAINTENANCE_PAGE_HTML` — static HTML for maintenance mode (503, auto-refresh) |
| **base-args** | `baseArgs` — shared `--config` and `--env` args for all commands |

### Key Config Types (`packages/cli/src/types/`)

```typescript
type ProjectType = "app" | "package"
type HealthType = "http" | "tcp"
type PipelineAction = "ci" | "deploy-prod" | "destroy" | "force-redeploy" | "pr-preview" | "pr-cleanup"
type SupabaseFeature = "storage" | "realtime"

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
interface R2ServiceConfig { bucket: string; public?: boolean }
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
  computed: {
    isSharedVps: boolean
    wildcardDomain: string
    hostPort: number
    bluePort: number
    greenPort: number
    developmentEnabled: boolean   // shorthand for environment.development.enabled
    prPreviewsEnabled: boolean    // shorthand for environment.development.pr_previews && enabled
    envDomain(env: string): string
    workspaceName(env: string): string
    imageTag(env: string, sha: string): string
    redirectDomains(env: string): string[]
    routeHostPort(subdomain: string): number       // deterministic port per route (10000-29999)
    routeGreenPort(subdomain: string): number      // green slot port per route (30000-49999)
    routeEnvDomain(subdomain: string, env: string): string  // env-aware route domain
  }
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
  hostPort: number; env: string; devPreviewPassword?: string; devPassword?: string
  mode?: "proxy" | "maintenance"
  sablier?: { group: string; sessionDuration: string; displayName: string }
  redirectDomains?: string[]; canonicalDomain?: string
  internal?: boolean  // Tailscale-only (Caddy remote_ip guard)
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
ci.yml (per-repo template — see `nextnode` skill)
  └─> pipeline.yml (reusable workflow_call, in infrastructure repo)
        ├─> Plan job (inline TOML parse, outputs project_type/has_lint/test/build)
        ├─> Lint job (pnpm lint)
        ├─> Test job (pnpm test)
        ├─> Build job (infra build --sha, GHCR push)
        ├─> [For packages] pipeline-package.yml
        │     └─> publish (pnpm dlx semantic-release)
        └─> [For apps] After quality gates:
              ├─> Provision (infra provision, + GitHub App token, + R2 setup)
              ├─> DNS (infra dns upsert --ip)
              ├─> Deploy (infra deploy --sha, via Tailscale VPN)
              ├─> [PR preview] PR Comment (upsert preview URL, create GH Deployment)
              ├─> [PR cleanup] preview-cleanup (scan + remove closed PR previews)
              └─> Prod gate: verify 3/3 CI checks passed via GitHub Checks API

destroy-vps.yml (workflow_dispatch — manual VPS destruction):
  inputs: mode (named|shared), names, environment, cleanup_workspace, confirm_prod
  jobs: validate → destroy (matrix over workspaces) → TF destroy + Tailscale cleanup
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
| `IMAGE` | GHCR image tag for the deployment |
| `HOST_PORT` | Deterministic hash-based port (10000-29999) |
| `NODE_ENV` | `production` for prod, `development` for others |
| `DOMAIN` | `[project].domain`, or VPS IP if no domain set |
| `PUBLIC_SITE_URL` | `https://<domain>`, or `http://<vps-ip>` if no domain set |
| `APP_PORT` | `[deploy].port` (default `4321`) |
| `HOST_PORT_{SERVICE}` | Per-route host port (only when `[[routes]]` defined). SERVICE = uppercased service name, hyphens → underscores |
| `APP_PORT_{SERVICE}` | Per-route container port (only when `[[routes]]` defined) |

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
     -> Prod: proxied (orange cloud), Non-prod: unproxied (grey cloud)
     -> CNAME conflict detection and cleanup
  -> DEPLOY:
     -> Acquire deploy lock (5min timeout, prevents concurrent deploys)
     -> Check VPS resources (disk/memory warnings, abort if critical)
     -> Show maintenance page (default strategy) or prepare blue-green slot
     -> Create /opt/apps/<app> on VPS
     -> Transform compose: replace build/image with GHCR tag, ensure caddy-net, inject route ports
     -> Generate .env (IMAGE, HOST_PORT, NODE_ENV, secrets, service vars, route vars, auto-vars)
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
- **Internal apps** — grey cloud (DNS points to Tailscale IP)
- **DNS ownership**: CLI manages app DNS records via Cloudflare API. Terraform only manages zone-level settings (DNSSEC, SSL mode)
- **Cleanup**: `infra dns delete` removes A/CNAME records for an app domain
- **Wildcard records**: `infra dns upsert` creates both `*.{domain}` and `{domain}` A records
- **Redirect domains**: `redirect_domains` config auto-creates DNS + Caddy redirect blocks (prod only, auto-adds www)
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
| **Supabase** | `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_URL`, `JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`, `APP_NAME` | URLs derived from domain; JWT keys auto-generated + stored as GH env secrets; POSTGRES_PASSWORD auto-generated + stored as GH env secret; OAuth vars via `computeOAuthEnvVars()` |
| **Supabase OAuth** | `GOTRUE_EXTERNAL_{PROVIDER}_ENABLED`, `_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI`, `_SCOPE` | Per-provider env vars from `[services.supabase.oauth]` config. Requires `{PROVIDER}_CLIENT_ID` + `{PROVIDER}_CLIENT_SECRET` as GH secrets. |
| **Redis** | `REDIS_URL` | `redis://redis:{port}` (default port 6379) |
| **R2** | `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ENDPOINT_URL`, `R2_PUBLIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Bucket from config; account ID + endpoint derived from CF API; public URL only if `public = true`; credentials forwarded from process.env (org secrets) |

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

- Route services get `ports: "${HOST_PORT_SERVICE}:${APP_PORT_SERVICE}"` injected (service name uppercased, hyphens → underscores)
- Route services get `caddy-net` network injected
- Route services keep their original `image:` (no ghcr.io replacement — only the main app service gets the built image)

### Caddy

- One handle block per route, placed in the correct site file:
  - Prod: `{domain}.caddy` (same as main app)
  - Dev/PR: `dev.{domain}.caddy` (same as PR previews)
- Routes inherit main app's `basic_auth`, Sablier, and `internal` guard
- App identifier: `{sanitizedAppName}-{subdomain}` (e.g., `fleurs-daujourdhui-admin`)

### Deploy Functions

- `extractComposeServiceNames(content)` — parse service names from compose
- `validateRouteServices(routes, composeServiceNames)` — deploy-time validation
- `sanitizeServiceEnvName(serviceName)` — convert to env var suffix
- `injectRouteCaddyNet(content, routeServiceNames)` — inject caddy-net into route services
- `deployRouteCaddyConfigs(ctx, routes)` — deploy Caddy configs for all routes

### Blue-Green

When `zero_downtime` is enabled, routes participate: each route gets blue/green ports, all handle blocks swap atomically in one Caddy reload.

### Destroy

`infra destroy` removes all route Caddy blocks from both `{domain}.caddy` and `dev.{domain}.caddy`.
