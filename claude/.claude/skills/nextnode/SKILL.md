---
name: nextnode
description: NextNode infrastructure reference. Auto-load when working on any NextNode or SaaS project — covers CI/CD pipeline, deployment, monitoring, Terraform modules, and nextnode.toml configuration.
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# NextNode Infrastructure Reference

## Architecture Overview

NextNode uses a **config-as-code driven, zero-manual-UI** infrastructure:

- **GitHub Actions** — CI/CD orchestration with a single reusable workflow
- **`infra` CLI** (TypeScript, citty) — CI/CD engine in `packages/cli/` — provision, deploy, destroy, rollback, build, lint, test, publish
- **Terraform 1.9** (TF Cloud backend) — VPS provisioning (Hetzner); DNS managed by CLI via Cloudflare API
- **Docker Compose** — app deployment on each VPS
- **Caddy** — native reverse proxy (xcaddy + Cloudflare DNS plugin), automatic SSL via ACME DNS-01
- **Tailscale** — secure internal mesh network (all VPSes connected)
- **Grafana Alloy** — push-based observability agent on every VPS

**Repository:** `NextNodeSolutions/infrastructure`

## nextnode.toml — The Single Config File

Every NextNode/SaaS repo has a `nextnode.toml` at its root. This file drives ALL pipeline behavior — no other CI config is needed beyond the 10-line reusable workflow caller.

```toml
[project]
name = "my-app"                    # REQUIRED — no default. Used for naming everywhere.
type = "app"                       # REQUIRED — "app" | "package" | "monitoring"
domain = "app.nextnode.fr"         # App-only — subdomain for the app
description = "Description"        # Optional
redirect_domains = ["www.app.fr"]  # Optional — domains that 301→canonical (prod only, auto-adds www)

[scripts]                          # Optional — defaults to pnpm lint/test/build
lint = "lint"
test = "test"
build = "build"

# === Package-only ===
[package]
scope = "@nextnode-solutions"
access = "public"                  # "public" | "restricted"
canary_on_label = true             # Publish canary on PR label "canary"

# === App-only: Server (4 tiers) ===
# No [server] = shared dev + shared prod VPS (Tier 1)
[server]                           # Tier 2: dedicated VPS (same for dev + prod)
type = "cpx22"                     # Hetzner server type (default: cpx22)
location = "nbg1"                  # Hetzner datacenter (default: nbg1)
internal = false                   # true = grey cloud (Tailscale), false = orange cloud (public)

# Tier 3: per-env server overrides
[environment.dev.server]
type = "cx22"                      # Smaller dev server
[environment.prod.server]
type = "cpx22"                     # Bigger prod server

# Tier 4: fully custom per-env (no top-level [server])
# [environment.dev.server]
# name = "client-dev"
# type = "cx22"
# location = "nbg1"

[volume]                           # Optional — default: disabled
enabled = false
size = 20                          # GB

[deploy]
port = 4321                        # Container port (auto-injected as APP_PORT in .env)
file = "docker-compose.yml"        # Explicit compose path (auto-detected if omitted)
zero_downtime = false              # Blue-green zero-downtime deployment

[health]                           # Optional — health check config
type = "http"                      # "http" | "tcp"
path = "/health"                   # HTTP health check path
interval = "30s"
timeout = "10s"
retries = 3

[sablier]                          # Idle container auto-stop (non-prod only)
enabled = true                     # Default: true
session_duration = "15m"           # Idle timeout before stopping containers
display_name = "My App"            # Display name on waiting page (default: project.name)

[environment.dev]
enabled = true                     # Default: true — set false to skip dev deployment

[environment.prod]
enabled = true                     # Default: true — set false to skip prod deployment
```

### .env Injection

At deploy time, the CLI builds the `.env` file for each app:

1. **All GitHub org secrets** are injected automatically as-is (`SECRET_NAME=value`), **except** infrastructure secrets (`HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `TF_CLOUD_TOKEN`, `TAILSCALE_OAUTH_*`, `SSH_PRIVATE_KEY`, `SLACK_BOT_TOKEN`, `GRAFANA_API_KEY`, `NPM_TOKEN`, `GITHUB_TOKEN`)
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

### Server Tier Resolution

| Config Present | Dev VPS | Prod VPS |
|---------------|---------|----------|
| No `[server]` | Shared dev VPS | Shared prod VPS |
| `[server]` only | Dedicated (shared dev+prod) | Same dedicated VPS |
| `[server]` + `[environment.X.server]` | Dedicated (overridden) | Dedicated (overridden) |
| `[environment.X.server]` only | Dedicated dev | Dedicated prod |

## CLI Commands

The `infra` CLI (`packages/cli/`) is built with **citty** and provides all CI/CD operations. All commands accept `--config <path>` and `--env <env>` base args.

| Command | Purpose | Key Args |
|---------|---------|----------|
| `infra plan` | Show resolved config and planned pipeline actions (dry run) | — |
| `infra lint` | Run `pnpm <lint-script>` | — |
| `infra test` | Run `pnpm <test-script>` | — |
| `infra build` | Build Docker image, push to ghcr.io | `--sha` |
| `infra provision` | Provision VPS via Terraform (skips if VPS healthy) | `--force`, `--plan-only` |
| `infra deploy` | Deploy app to VPS via SSH + Docker Compose | `--sha` |
| `infra dns upsert` | Create/update DNS A record | `--ip` |
| `infra dns delete` | Delete DNS records for app | — |
| `infra dns list` | List DNS records for domain | — |
| `infra destroy` | Destroy VPS + cleanup (smart shared VPS handling) | `--app`, `--yes`, `--cleanup-workspace` |
| `infra rollback` | Rollback to a previous git ref | `--ref`, `--skip-build`, `--yes` |
| `infra status` | Check VPS, containers, DNS, Caddy health | `--json` |
| `infra pipeline` | Run full CI/CD pipeline (provision + DNS + deploy) | `--sha`, `--force`, `--skip-quality` |
| `infra publish` | Publish npm package (release or canary) | — |

### CLI Libraries (`packages/cli/src/lib/`)

| Library | Key Functions |
|---------|---------------|
| **config** | `loadConfig()`, `computeHostPort()`, `computeEnvDomain()`, `computeWorkspaceName()`, `computeImageTag()`, `detectDockerConfig()` |
| **cloudflare** | `lookupZoneId()`, `upsertDnsRecord()`, `deleteDnsRecord()`, `listDnsRecords()` — with retry for rate limiting |
| **dns** | `resolveProxied()`, `resolveDnsTarget()`, `upsertWildcardRecords()` |
| **ssh** | `sshExec()`, `scp()`, `writeKeyFile()` — SSH via Tailscale hostnames |
| **terraform** | `terraformInit()`, `terraformPlan()`, `terraformApply()`, `terraformOutput()`, `terraformDestroy()` |
| **tfcloud** | `ensureWorkspace()`, `deleteWorkspace()`, `hasResources()` |
| **tailscale** | `deleteDevice()`, `generateAuthKey()`, `getDeviceIp()` — OAuth token caching |
| **caddy** | `generateCaddyFileContent()`, `deployCaddyConfig()`, `removeCaddyAppConfig()`, `reloadCaddy()`, `waitForCaddy()` |
| **docker** | `dockerBuild()`, `dockerPush()`, `dockerLogin()` |
| **github** | `verifyCiPassed()`, `getCheckRuns()` — prod gate CI verification |
| **hetzner** | `fetchHetznerSshKeyIds()` |
| **exec** | `exec()`, `execCapture()`, `requireBinary()` — process execution with logging |
| **logger** | `logger` (consola), `withTiming()` |
| **secrets** | `validateSecrets()`, `requireEnv()` |

## Pipeline Behavior

### Per-repo CI files (3 workflow files per app repo)

**CRITICAL:** The caller workflow MUST declare `permissions` for the reusable workflow to function. Without it, `GITHUB_TOKEN` defaults to read-only and operations will fail.

> **Why permissions in the caller?** With reusable workflows, `permissions` in the called workflow can only **restrict** the caller's permissions, not expand them. The caller must grant the ceiling.

#### 1. `.github/workflows/ci.yml` — Main CI pipeline

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  checks: read
  contents: read
  packages: write

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  pipeline:
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    with:
      action: ${{ inputs.action || 'ci' }}
      environment: ${{ inputs.environment || 'dev' }}
    secrets: inherit
```

#### 2. `.github/workflows/deploy-prod.yml` — Manual production deploy

```yaml
name: Deploy to Production

on:
  workflow_dispatch:

permissions:
  checks: read
  contents: read
  packages: write

jobs:
  deploy:
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    with:
      action: deploy-prod
      environment: prod
    secrets: inherit
```

#### 3. `.github/workflows/destroy.yml` — Manual environment destroy

```yaml
name: Destroy Environment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment to destroy"
        required: true
        type: choice
        options:
          - dev

permissions:
  contents: read
  packages: write

jobs:
  destroy:
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    with:
      action: destroy
      environment: ${{ inputs.environment }}
    secrets: inherit
```

### How the 3 workflows map to pipeline actions

The reusable workflow (`pipeline.yml`) accepts `action` and `environment` inputs:

| Workflow | `action` | `environment` | Trigger |
|----------|----------|---------------|---------|
| `ci.yml` | `ci` (default) | `dev` (default) | push/PR/manual |
| `deploy-prod.yml` | `deploy-prod` | `prod` | manual only |
| `destroy.yml` | `destroy` | user picks (dev) | manual only |

### What happens on PR

| Project Type | Actions |
|-------------|---------|
| **Package** | Lint -> Test -> Build (no publish) |
| **Package + canary label** | Lint -> Test -> Build -> Canary publish (`0.0.0-canary.<sha>`) |
| **App** | Lint -> Test -> Build |

### What happens on merge to main

| Project Type | Actions |
|-------------|---------|
| **Package** | Lint -> Test -> Build -> semantic-release (npm publish + GitHub Release) |
| **App** | Lint -> Test -> Build -> Provision -> DNS -> Deploy dev -> [Prod gate] -> Deploy prod |

### Workflow architecture

```
ci.yml (per-repo template)
  └─> pipeline.yml (reusable workflow_call, in infrastructure repo)
        ├─> Plan job (inline TOML parse)
        ├─> Lint job (pnpm lint)
        ├─> Test job (pnpm test)
        ├─> Build job (infra build --sha)
        ├─> [Internal] pipeline-package.yml (if package)
        │     └─> publish (infra publish)
        └─> [For apps] After quality gates:
              ├─> Provision (infra provision)
              ├─> DNS (infra dns upsert --ip)
              ├─> Deploy (infra deploy --sha)
              └─> Prod gate: verify CI passed via GitHub Checks API

Standalone action workflows (infrastructure repo, workflow_dispatch):
  action-rollback.yml        — inputs: app, env → infra rollback
  action-setup-email.yml     — inputs: domain, dkim_names, dkim_values, dmarc_email
  action-destroy-vps.yml     — inputs: app, env, domain → infra destroy + dns delete
  pipeline-monitoring.yml    — inputs: action → infra provision/deploy for monitoring stack
```

### How workflows invoke the CLI

Workflows check out the infra repo to `.infra/` with sparse-checkout (`packages/cli`, `nextnode.default.toml`, `terraform`), then invoke:

```bash
cd .infra && node packages/cli/dist/index.js <command> \
  --env "$ENV" --sha "${{ github.sha }}" \
  --config "../${{ inputs.config_file }}"
```

### Commit Convention

Uses **Conventional Commits** — semantic-release reads these to determine version bumps:
- `feat:` — minor version bump
- `fix:` — patch version bump
- `feat!:` or `BREAKING CHANGE:` — major version bump

## Terraform Structure

Located in `infrastructure/terraform/`:

```
terraform/
├── apps/          # Variable-driven app infrastructure (vps + volume composition)
├── modules/
│   ├── vps/       # Hetzner VPS: hcloud_server, hcloud_firewall
│   └── volume/    # Hetzner volume: hcloud_volume (ext4, automount)
└── global/        # Cloudflare zone-level settings (zones, DNSSEC, SSL mode)
```

- **No DNS/SSL Terraform modules** — DNS records are managed by CLI via Cloudflare API
- **No environments/ dirs** — replaced by TF Cloud workspaces (variable-driven approach)
- **One `apps/` module** used by ALL apps — TF Cloud workspaces isolate state per app

## VPS Setup (cloud-init)

Every VPS is provisioned with **Debian 12** and auto-configured via `templates/cloud-init.yml`:

- **Docker** + docker-compose-plugin
- **Caddy** (built natively via xcaddy with Cloudflare DNS plugin)
- **Tailscale** (ephemeral auth key, auto-joins tailnet)
- **Grafana Alloy** agent (auto-discovers all Docker containers)
- **fail2ban** for SSH protection
- **deploy** user (docker + sudo groups)
- **Automatic security updates**

## docker-compose.yml Standard (App)

Every app repo MUST have a `docker-compose.yml` at root. Caddy runs **natively on the VPS** (not in Docker) and reverse-proxies to `localhost:HOST_PORT` — so apps do NOT need a `proxy-public` external network.

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${HOST_PORT}:${APP_PORT}"
    restart: unless-stopped
    environment:
      - NODE_ENV=${NODE_ENV}
```

**Key rules:**
- **No `proxy-public` network** — Caddy is native, not containerized. It reaches the app via host port mapping.
- **No `env_file`** — use `environment` block with individual variables. CLI injects all env vars into `.env` at deploy time; compose references only the ones it needs.
- **No `container_name`** — let Docker Compose auto-name containers.
- **No inline `healthcheck`** — put health checks in the `Dockerfile` instead (via `HEALTHCHECK` instruction).
- **`restart: unless-stopped`** — standard restart policy for all production services.
- **Port mapping** — `${HOST_PORT}:${APP_PORT}` where `HOST_PORT` is the CLI-assigned hash-based port (10000-29999) and `APP_PORT` is the port the app listens on inside the container (from `nextnode.toml [deploy].port`).

## Deployment Flow (App)

```
GitHub Actions triggers CLI pipeline (infra pipeline --sha <sha>)
  -> Load and validate nextnode.toml (smol-toml + defu merge with defaults)
  -> Resolve server tier (shared vs dedicated)
  -> QUALITY GATE: lint, test, build (parallel, unless --skip-quality)
  -> PROD GATE (prod only): verify Lint/Test/Build passed via GitHub Checks API
  -> PROVISION:
     -> Ensure TF Cloud workspace exists
     -> Fetch Hetzner SSH key IDs
     -> Generate ephemeral Tailscale auth key
     -> terraform plan → apply (skip if VPS exists and healthy)
     -> Wait for SSH via Tailscale hostname
     -> Get Tailscale IP
  -> DNS:
     -> If no domain: skip
     -> Upsert A record (+ wildcard records)
     -> Prod: proxied (orange cloud), Non-prod: unproxied (grey cloud)
     -> CNAME conflict detection and cleanup
  -> DEPLOY:
     -> Create /opt/apps/<app> on VPS
     -> Transform compose: replace build/image with GHCR tag, ensure caddy-net
     -> Generate .env (IMAGE, HOST_PORT, NODE_ENV, secrets, auto-vars)
     -> docker compose pull → up -d --remove-orphans
     -> Configure Caddy (reverse proxy + optional basic_auth)
     -> Health checks (container + HTTP)
```

### TF Cloud Workspaces

| Workspace | Contents |
|-----------|----------|
| `nextnode-shared-dev` | Shared dev VPS, Caddy (DNS managed by CLI) |
| `nextnode-shared-prod` | Shared prod VPS, Caddy (DNS managed by CLI) |
| `nextnode-monitoring` | Monitoring VPS + volume |
| `nextnode-<app>` | Per-app dedicated VPS + volume (DNS managed by CLI) |

Workspaces are auto-created by CLI (`ensureWorkspace()`). No manual bootstrap needed.

## Monitoring Stack

**Centralized monitoring VPS** (cx23, nbg1) running:

| Component | Port | Purpose |
|-----------|------|---------|
| **Grafana 11.5** | 3000 | Dashboards at `grafana.nextnode.fr` (Tailscale only, no login) |
| **Loki 3.4** | 3100 | Log aggregation (30-day retention) |
| **Prometheus v3.2** | 9090 | Metrics via remote-write receiver (30-day retention) |
| **Alertmanager v0.28** | 9093 | Alert routing to Slack |

**Push-only architecture:** Alloy agents on each VPS push logs + metrics to the monitoring VPS via Tailscale. No inbound connections to app VPSes.

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
- **Caddy ACME** — origin certs via Let's Encrypt DNS-01 challenge (Cloudflare DNS plugin)
- **Full (Strict) SSL mode** — origin cert validation required
- **Public apps** — orange cloud (Cloudflare proxied, CDN + DDoS protection)
- **Internal apps** — grey cloud (DNS points to Tailscale IP)
- **DNS ownership**: CLI manages app DNS records via Cloudflare API. Terraform only manages zone-level settings (DNSSEC, SSL mode).
- **Cleanup**: `infra dns delete` removes A/CNAME records for an app domain
- **Caddy sites**: Per-app Caddy config with wildcard domain, handle blocks per app
- **CNAME conflict detection**: auto-detects and deletes conflicting CNAME records before creating A records (prevents migration issues from Railway/Vercel)
- **Wildcard records**: `infra dns upsert` creates both `*.{domain}` and `{domain}` A records

## Dev Environment Auth

Non-prod deployments can be protected with Caddy basic auth via org-level GitHub secrets:

| Secret | User | Purpose |
|--------|------|---------|
| `DEV_PREVIEW_PASSWORD` | `preview` | Share with clients for preview access |
| `DEV_PASSWORD` | `dev` | Internal team access |

- CLI's `deployCaddyConfig()` generates bcrypt hashes on VPS using `caddy hash-password`
- Injects `basic_auth` block into Caddyfile for non-prod environments when domain is set and passwords are provided
- Graceful fallback: if passwords not set, deploys without auth

## Smart Shared VPS Handling

The `infra destroy` command intelligently handles shared VPS:
- Checks if other apps are running on the shared VPS
- If other apps exist: removes only this app's containers, DNS, and Caddy config — keeps VPS alive
- If last app: full VPS destruction via Terraform destroy + Tailscale cleanup

## GitHub Org Secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm package publishing |
| `HETZNER_API_TOKEN` | VPS provisioning |
| `CLOUDFLARE_API_TOKEN` | DNS/SSL management |
| `TF_CLOUD_TOKEN` | Terraform Cloud API (workspace mgmt + state) |
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth — generates ephemeral auth keys for new VPSes |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Tailscale OAuth — paired with client ID |
| `SSH_PRIVATE_KEY` | SSH private key for deploy user |
| `SLACK_BOT_TOKEN` | Slack notifications + alerts |
| `GRAFANA_API_KEY` | Grafana annotations API |
| `DEV_PREVIEW_PASSWORD` | Optional — basic auth for `preview` user on non-prod environments |
| `DEV_PASSWORD` | Optional — basic auth for `dev` user on non-prod environments |

### Production Approval Gate

The `infra pipeline` command (for `deploy-prod` action) verifies that Lint, Test, and Build checks all passed on the commit SHA via GitHub Checks API before allowing production deployment.
