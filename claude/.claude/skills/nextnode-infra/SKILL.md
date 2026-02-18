---
name: nextnode-infra
description: NextNode infrastructure operations — CLI commands, Terraform, VPS provisioning, deployment, monitoring, and DNS/SSL. For repo compliance and nextnode.toml config, see the `nextnode` skill.
user-invocable: true
autoload-dirs: []
---

# NextNode Infrastructure Reference

> **`nextnode.toml` configuration** is documented in the `nextnode` skill (auto-loaded on all NextNode repos). This skill focuses on infrastructure operations.

## SSH Access

> **MANDATORY:** All SSH connections to NextNode infrastructure MUST use the key `~/.ssh/nextnode-ci`. Never use the default SSH key or any other identity file.

## Architecture Overview

NextNode uses a **config-as-code driven, zero-manual-UI** infrastructure:

- **GitHub Actions** — CI/CD orchestration with a single reusable workflow
- **`infra` CLI** (TypeScript, citty) — CI/CD engine in `packages/cli/` — provision, deploy, destroy, rollback, build, lint, test, publish
- **Terraform 1.9** (TF Cloud backend) — VPS provisioning (Hetzner); DNS managed by CLI via Cloudflare API
- **Docker Compose** — app deployment on each VPS
- **Caddy** — native reverse proxy (xcaddy + Cloudflare DNS, Sablier, certmagic-s3 plugins), SSL via ACME DNS-01 (HTTP-01 fallback), R2-backed cert storage
- **Sablier** — idle container auto-stop for non-prod environments (custom NextNode waiting page)
- **Tailscale** — secure internal mesh network (all VPSes connected)
- **Grafana Alloy** — push-based observability agent on every VPS

**Repository:** `NextNodeSolutions/infrastructure`

## CLI Commands

The `infra` CLI (`packages/cli/`) is built with **citty**. All commands accept `--config <path>` and `--env <env>` base args.

| Command | Purpose | Key Args |
|---------|---------|----------|
| `infra plan` | Show resolved config and planned pipeline actions (dry run) | — |
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
| **config** | `loadConfig()`, `parseConfig()`, `mergeConfig()`, `validateConfig()`, `resolveConfigInput()`, `computeHostPort()`, `computeGreenPort()`, `computeEnvDomain()`, `computeWildcardDomain()`, `computeRedirectDomains()`, `computePreviewDomain()`, `isPrPreview()`, `detectDockerConfig()`, `findDefaultTomlPath()` |
| **cloudflare** | `lookupZoneId()`, `upsertDnsRecord()`, `deleteDnsRecord()`, `listDnsRecords()`, `resolveCloudflareAccountId()` — with retry for rate limiting |
| **dns** | `resolveDnsTarget()`, `resolveProxied()`, `resolveTtl()`, `upsertWildcardRecords()`, `upsertDevWildcardRecord()`, `upsertRedirectDnsRecords()`, `deleteRedirectDnsRecords()` |
| **ssh** | `sshExec()`, `scp()`, `withSshKey()`, `writeKeyFile()`, `cleanupKeyFile()` — SSH via Tailscale hostnames |
| **terraform** | `terraformInit()`, `terraformPlan()`, `terraformApply()`, `terraformOutput()`, `terraformDestroy()`, `terraformDestroyTargeted()` |
| **tfcloud** | `getWorkspace()`, `ensureWorkspace()`, `deleteWorkspace()`, `hasResources()` |
| **tailscale** | `deleteDevice()`, `generateAuthKey()`, `getDeviceIp()` — OAuth token caching |
| **caddy** | `generateHandleBlock()`, `generateBasicAuthBlock()`, `generateMaintenanceBlock()`, `generateCaddyFileContent()`, `generateRedirectBlock()`, `updateCaddyFile()`, `deployCaddyConfig()`, `removeCaddyBlock()`, `removeCaddyAppConfig()`, `switchToReverseProxy()`, `switchToMaintenance()`, `writeCaddyConfigAtomic()`, `restoreCaddyBackup()`, `reloadCaddy()`, `waitForCaddy()`, `sanitizeAppIdentifier()` |
| **caddy-lifecycle** | `createCaddyLifecycle()` — strategy pattern: `RealCaddyLifecycle` (domain) / `NoOpCaddyLifecycle` (no domain). Interface: `showMaintenance()`, `restoreProxy()`, `switchTraffic()` |
| **compose-validation** | `validateCompose()` — check docker-compose.yml for common issues |
| **port-validation** | `validatePortConsistency()`, `validateDockerfile()`, `validateComposePort()`, `validateFrameworkConfig()` |
| **docker** | `dockerBuild()`, `dockerPush()`, `dockerLogin()` |
| **dockerfile** | `parseDockerfileEnv()` — extract ARG/ENV declarations from Dockerfile. `INFRA_MANAGED_VARS` constant excludes `NODE_ENV`, `PORT`, `APP_PORT`, `HOST_PORT`, `IMAGE`, `COMPOSE_PROJECT_NAME` |
| **github** | `verifyCiPassed()`, `getCheckRuns()`, `getCommitStatus()`, `getWorkflowRun()` — prod gate CI verification |
| **hetzner** | `fetchHetznerSshKeyIds()` |
| **services** | `computeServiceEnvVars()` — derives env vars from `[services]` config: Supabase (URL + auto-generated JWT keys stored as GH env secrets), Redis (URL), R2 (endpoint + public URL) |
| **r2** | `ensureR2Setup()`, `ensureR2Bucket()`, `ensureR2Credentials()` — self-healing R2 setup for Caddy cert storage. Auto-creates bucket + credentials, injects into `process.env`, best-effort stores as GitHub org secrets |
| **http** | `fetchWithRetry()` — generic fetch with exponential backoff on 429 |
| **polling** | `pollUntilReady()` — generic retry/polling (SSH wait, Tailscale wait, Caddy wait) |
| **exec** | `exec()`, `execCapture()`, `checkBinary()`, `requireBinary()` — process execution with secret redaction |
| **logger** | `logger` (consola), `withTiming()` |
| **secrets** | `validateSecrets()`, `requireEnv()` |
| **constants** | `TF_CLOUD_ORG`, `TAILNET`, `TERRAFORM_DIR`, `GITHUB_ORG`, `R2_BUCKET_NAME`, `CLOUDFLARE_API`, secret group constants |
| **maintenance-page** | `MAINTENANCE_PAGE_HTML` — static HTML for maintenance mode (503, auto-refresh) |
| **base-args** | `baseArgs` — shared `--config` and `--env` args for all commands |

### Key Config Types (`packages/cli/src/types/`)

```typescript
type ProjectType = "app" | "package" | "monitoring"
type HealthType = "http" | "tcp"
type PipelineAction = "ci" | "deploy-prod" | "destroy" | "force-redeploy" | "pr-preview" | "pr-cleanup"

interface ResourcesConfig {
  cpu_limit?: string       // e.g. "1.0"
  memory_limit?: string    // e.g. "1G", "256M"
  cpu_reservation?: string
  memory_reservation?: string
}

interface EnvironmentEntry extends ResourcesConfig {
  enabled: boolean
}

interface ProjectConfig {
  project: { name: string; type: ProjectType; domain?: string; description?: string; redirect_domains?: string[] }
  scripts: { lint?: string; test?: string; build?: string }
  server?: { type: string; location: string; internal: boolean }
  volume: { enabled: boolean; size: number }
  deploy: { port: number; file?: string; hasCompose: boolean; zero_downtime: boolean }
  health: { type: HealthType; path?: string; interval: string; timeout: string; retries: number }
  environment: { dev: EnvironmentEntry; prod: EnvironmentEntry }
  sablier?: { enabled: boolean; session_duration: string; display_name: string }
  services?: { supabase?: { studio_port?; migrations? }; r2?: { bucket; public? }; redis?: { port? } }
  computed: {
    isSharedVps: boolean
    wildcardDomain: string
    hostPort: number
    bluePort: number
    greenPort: number
    devEnabled: boolean
    envDomain(env: string): string
    workspaceName(env: string): string
    imageTag(env: string, sha: string): string
    redirectDomains(env: string): string[]
  }
}
```

### Deploy Types (`packages/cli/src/types/deploy.ts`)

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
  sablier?: { containerName: string; sessionDuration: string; displayName: string }
  redirectDomains?: string[]; canonicalDomain?: string
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

1. **All GitHub org secrets** are injected automatically, **except** infrastructure secrets (`HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `TF_CLOUD_TOKEN`, `TAILSCALE_OAUTH_*`, `SSH_PRIVATE_KEY`, `SLACK_BOT_TOKEN`, `GRAFANA_API_KEY`, `NPM_TOKEN`, `GITHUB_TOKEN`)
2. **Auto-injected variables** (if not already present from secrets):

| Variable | Source |
|----------|--------|
| `IMAGE` | GHCR image tag for the deployment |
| `HOST_PORT` | Deterministic hash-based port (10000-29999) |
| `NODE_ENV` | `production` for prod, `development` for others |
| `DOMAIN` | `[project].domain`, or VPS IP if no domain set |
| `PUBLIC_SITE_URL` | `https://<domain>`, or `http://<vps-ip>` if no domain set |
| `APP_PORT` | `[deploy].port` (default `4321`) |

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
| `nextnode-monitoring` | Monitoring VPS + volume |
| `nextnode-<app>` | Per-app dedicated VPS + volume (DNS managed by CLI) |

Workspaces are auto-created by CLI (`ensureWorkspace()`). No manual bootstrap needed.

## VPS Setup (cloud-init)

Every VPS is provisioned with **Debian 12** and auto-configured via `templates/cloud-init.yml`. Install scripts are base64-embedded in `templates/scripts/`.

- **Docker** + docker-compose-plugin + buildx-plugin
- **Caddy** (xcaddy with `cloudflare`, `sablier-caddy-plugin`, `certmagic-s3` plugins) — R2-backed cert storage, DNS-01 ACME
- **Tailscale** (ephemeral auth key, auto-joins tailnet)
- **Sablier** v1.9.0 (idle container auto-stop, custom NextNode waiting page, connected to `caddy-net`)
- **Grafana Alloy** agent (auto-discovers Docker containers, pushes to monitoring VPS)
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
     -> Transform compose: replace build/image with GHCR tag, ensure caddy-net
     -> Generate .env (IMAGE, HOST_PORT, NODE_ENV, secrets, service vars, auto-vars)
     -> Checkpoint-based deploy: init → pull → compose-up → caddy-config → caddy-reload → health-check → cleanup → done
     -> If zero_downtime: blue-green (two slots, health check inactive, atomic Caddy switch, 30s drain)
     -> Else: maintenance page → docker compose pull → up → switch to reverse proxy
     -> Atomic Caddy writes (backup + restore on failure)
     -> Persist deploy state (.deploy-state JSON on VPS: activeSlot, imageTag, deployedAt)
     -> Health checks (container + HTTP)
     -> Clean up old Docker images
     -> Release deploy lock
     -> Resume support: --resume flag replays from last checkpoint on failure
```

### Smart Shared VPS Handling

The `infra destroy` command intelligently handles shared VPS:
- Checks if other apps are running on the shared VPS
- If other apps exist: removes only this app's containers, DNS, and Caddy config — keeps VPS alive
- If last app: full VPS destruction via Terraform destroy + Tailscale cleanup

## Monitoring Stack

**Centralized monitoring VPS** (cx23, nbg1) running:

| Component | Port | Purpose |
|-----------|------|---------|
| **Grafana 11.5** | 3000 | Dashboards at `grafana.nextnode.fr` (Tailscale only, no login) |
| **Loki 3.4** | 3100 | Log aggregation (30-day retention) |
| **Prometheus v3.2** | 9090 | Metrics via remote-write receiver (30-day retention) |
| **Alertmanager v0.28** | 9093 | Alert routing to Slack |

**Push-only architecture:** Alloy agents on each VPS push logs + metrics to the monitoring VPS via Tailscale.

### Grafana Dashboards

1. **Infrastructure Overview** — CPU, memory, disk, network per VPS
2. **Container Dashboard** — Per-container resource usage (cAdvisor)
3. **App Logs Explorer** — Search/filter logs by app, level, container
4. **Deployment Tracker** — Deployment timeline with annotations

### Slack Channels

| Channel | Alerts |
|---------|--------|
| `#alerts-critical` | Container down, disk >90%, OOM, service down |
| `#alerts-general` | High CPU, high memory, restart loops, cert expiry |
| `#deployments` | Deploy start/approve/complete/fail/rollback with details |

## DNS & SSL Strategy

- **Cloudflare Universal SSL** — edge certs (free, auto-managed)
- **Caddy ACME** — origin certs via Let's Encrypt DNS-01 challenge (Cloudflare DNS plugin), HTTP-01 fallback, certs stored in Cloudflare R2 (`nextnode-caddy-certs` bucket via certmagic-s3)
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
| `SLACK_BOT_TOKEN` | Slack notifications + alerts |
| `GRAFANA_API_KEY` | Grafana annotations API |
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
| **Supabase** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | JWT keys auto-generated + stored as GH environment secrets |
| **Redis** | `REDIS_URL` | `redis://redis:{port}` (default port 6379) |
| **R2** | `R2_ENDPOINT`, `R2_PUBLIC_URL` | Derived from Cloudflare account ID + bucket config |
