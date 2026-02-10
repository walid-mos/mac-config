---
name: nextnode-infra
description: NextNode infrastructure reference — CI/CD pipeline, Dagger modules, Terraform, VPS provisioning, deployment, monitoring, and DNS/SSL.
user-invocable: true
autoload-dirs: []
---

# NextNode Infrastructure Reference

## Architecture Overview

NextNode uses a **config-as-code driven, zero-manual-UI** infrastructure:

- **GitHub Actions** — CI/CD orchestration with a single reusable workflow
- **Dagger 0.19.11** (TypeScript SDK) — composable CI/CD modules for build, test, deploy
- **Terraform 1.9** (TF Cloud backend) — VPS provisioning (Hetzner) + DNS/SSL (Cloudflare)
- **Docker Compose** — app deployment on each VPS
- **Traefik v3** — reverse proxy, automatic SSL via Let's Encrypt DNS challenge
- **Tailscale** — secure internal mesh network (all VPSes connected)
- **Grafana Alloy** — push-based observability agent on every VPS

**Repository:** `NextnodeSolutions/infrastructure`

## nextnode.toml — The Single Config File

Every NextNode/SaaS repo has a `nextnode.toml` at its root. This file drives ALL pipeline behavior — no other CI config is needed beyond the 10-line reusable workflow caller.

```toml
[project]
name = "my-app"                # Required — used for naming everywhere
type = "package" | "app"       # Required — determines pipeline flow
domain = "app.nextnode.fr"     # App-only — subdomain for the app
description = "Description"    # Optional

[scripts]                      # Optional — defaults to pnpm lint/test/build
lint = "lint"
test = "test"
build = "build"

# === Package-only ===
[package]
scope = "@nextnode"
access = "public" | "restricted"
canary_on_label = true         # Publish canary on PR label "canary"

# === App-only: Server (4 tiers) ===
# No [server] = shared dev + shared prod VPS (Tier 1)
[server]                       # Tier 2: dedicated VPS (same for dev + prod)
type = "cpx21"                 # Hetzner server type (default: cpx22)
location = "nbg1"              # Hetzner datacenter (default: nbg1)
internal = true                # true = grey cloud (Tailscale), false = orange cloud (public)

# Tier 3: per-env server overrides
[environment.dev.server]
type = "cx22"                  # Smaller dev server
[environment.prod.server]
type = "cpx22"                 # Bigger prod server

# Tier 4: fully custom per-env (no top-level [server])
# [environment.dev.server]
# name = "client-dev"
# type = "cx22"
# location = "nbg1"

[volume]                       # Optional — auto-provisions Hetzner block storage
enabled = true
size = 20                      # GB

[deploy]
strategy = "docker-compose"
file = "docker-compose.yml"
dockerfile = "./Dockerfile"
context = "./"
port = 4321                    # App port (auto-injected as APP_PORT in .env)

[health]                       # Optional — health check config
type = "http"                  # "http" | "tcp" | "command"
endpoint = "/health"           # For http type
port = 8080                    # For tcp type
interval = "30s"
timeout = "10s"
retries = 3

[environment.dev]
auto_deploy = true
pr_deploys = true
# resources = { memory = "512m", cpu = "0.5" }  # Optional per-env resource limits

[environment.prod]
auto_deploy = false
approvers = ["walid"]

[rollback]
enabled = true
keep_versions = 5
```

### .env Injection

At deploy time, the VPS module builds the `.env` file for each app:

1. **All GitHub org secrets** are injected automatically as-is (`SECRET_NAME=value`), **except** infrastructure secrets (`HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `TF_CLOUD_TOKEN`, `TS_OAUTH_*`, `VPS_SSH_KEY`, `SLACK_BOT_TOKEN`, `GRAFANA_API_KEY`, `NPM_TOKEN`, `github_token`)
2. **Auto-injected variables** (if not already present from secrets):

| Variable | Source |
|----------|--------|
| `DOMAIN` | `[project].domain`, or VPS IP if no domain set |
| `PUBLIC_SITE_URL` | `https://<domain>`, or `http://<vps-ip>` if no domain set |
| `APP_PORT` | `[deploy].port` (default `4321`) |

No `[env]` section needed — secret names in GitHub match `.env` key names 1:1.

### Server Tier Resolution

| Config Present | Dev VPS | Prod VPS |
|---------------|---------|----------|
| No `[server]` | Shared dev VPS | Shared prod VPS |
| `[server]` only | Dedicated (shared dev+prod) | Same dedicated VPS |
| `[server]` + `[environment.X.server]` | Dedicated (overridden) | Dedicated (overridden) |
| `[environment.X.server]` only | Dedicated dev | Dedicated prod |

## Pipeline Behavior

### Per-repo CI file (identical in every repo)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      release_mode:
        description: "Release mode"
        required: false
        type: choice
        default: "none"
        options:
          - none
          - release
          - canary
permissions:
  contents: write
  issues: write
  pull-requests: write
jobs:
  pipeline:
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    permissions:
      contents: write
      issues: write
      pull-requests: write
    with:
      release_mode: ${{ inputs.release_mode || 'none' }}
    secrets: inherit
```

### Manual dispatch (`workflow_dispatch`)

The `release_mode` input allows manually triggering releases/canary publishes:

| Value | Behavior |
|-------|----------|
| `none` (default) | Lint -> Test -> Build only (no publish) |
| `release` | Lint -> Test -> Build -> Full release (semantic-release for packages, deploy for apps) |
| `canary` | Lint -> Test -> Build -> Canary publish (`0.0.0-canary.<sha>`) — packages only |

The infrastructure repo's `pipeline.yml` also accepts `release_mode` directly via its own `workflow_dispatch` (for rollback operations, it has separate `action`, `app`, `env` inputs).

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
| **App** | Lint -> Test -> Build -> Deploy dev -> Ensure prod env -> [Manual approval] -> Deploy prod |

### Commit Convention

Uses **Conventional Commits** — semantic-release reads these to determine version bumps:
- `feat:` — minor version bump
- `fix:` — patch version bump
- `feat!:` or `BREAKING CHANGE:` — major version bump

## Dagger Modules

Seven TypeScript modules in `infrastructure/dagger-modules/`:

| Module | Key Functions | Purpose |
|--------|--------------|---------|
| **pipeline** | `plan(config, eventName, ref, prLabels, releaseMode)`, `lint()`, `test()`, `build()` | Reads nextnode.toml, outputs job matrix. `releaseMode` accepts `"none"`, `"release"`, `"canary"` |
| **npm** | `publish()`, `canaryPublish()` | semantic-release with zero config in repos |
| **docker** | `build()`, `buildAndPush()`, `export()` | Docker image build, GHCR push, and tarball export |
| **vps** | `provisionAndDeploy(config, source, environment, tfSource, ...secrets, appSecrets, force)`, `provision()`, `deploy()`, `status()`, `rollback()`, `destroy()`, `cleanupDns(domain, cloudflareToken)` | Terraform provisioning + SSH deployment + DNS management via Cloudflare API. Internally: `ensureWorkspace()`, `lookupCloudflareZoneId()`, `lookupHetznerSshKeyIds()`, `generateTailscaleAuthKey()`, `upsertDnsRecord()`, `getTailscaleIp()`, `buildEnvFile()` |
| **dns** | `verifyPropagation()`, `verifyTxt()`, `lookup()` | DNS verification (Terraform creates, Dagger verifies) |
| **secrets** | `inject()`, `verify()`, `rotate()` | SSH-based secret injection to VPS |
| **monitoring** | `deploy()`, `update()`, `status()`, `annotate()`, `notifyDeploy()` | Monitoring stack + Grafana annotations |

### Pipeline plan() logic

```typescript
// isRelease triggers: push to main OR workflow_dispatch for apps OR manual releaseMode === "release"
const isRelease = (eventName === "push" && ref === "refs/heads/main")
  || (eventName === "workflow_dispatch" && cfg.project.type === "app")
  || releaseMode === "release";
// isCanary triggers: PR with "canary" label (if enabled) OR manual releaseMode === "canary"
const isCanary = (eventName === "pull_request" && type === "package" && canaryEnabled && labels.includes("canary"))
  || releaseMode === "canary";
```

### Workflow architecture

```
ci.yml (per-repo template)
  └─> pipeline.yml (reusable, in infrastructure repo)
        ├─> Plan job (Dagger pipeline.plan())
        ├─> Lint job
        ├─> Test job
        ├─> Build job
        ├─> pipeline-package.yml (if package + release/canary)
        │     ├─> canary-publish (Dagger npm.canaryPublish())
        │     └─> publish (Dagger npm.publish() via semantic-release)
        ├─> pipeline-app.yml (if app + release)
        │     ├─> deploy-dev (Dagger vps.provisionAndDeploy())
        │     ├─> ensure-prod-environment (auto-configure GitHub environment protection)
        │     └─> deploy-prod (requires "production" environment approval via vars.PROD_REVIEWER_ID)
        └─> rollback (workflow_dispatch only, Dagger vps.rollback())
```

## Terraform Modules

Located in `infrastructure/terraform/`:

| Module | Provider | Resources |
|--------|----------|-----------|
| `modules/vps` | Hetzner | `hcloud_server`, `hcloud_firewall` |
| `modules/dns` | Cloudflare | `cloudflare_zone`, `cloudflare_dns_record`, `cloudflare_zone_dnssec` (used by environments only — apps use Dagger DNS) |
| `modules/ssl` | Cloudflare | `cloudflare_zone_setting` (Full Strict, TLS 1.2+, HTTPS rewrites) |
| `modules/volume` | Hetzner | `hcloud_volume` (ext4, automount) |

**Environments:** `terraform/environments/prod/` and `terraform/environments/monitoring/`

## VPS Setup (cloud-init)

Every VPS is provisioned with Ubuntu 24.04 and auto-configured via `templates/cloud-init.yml`:

- **Docker** + docker-compose-plugin
- **Tailscale** (ephemeral auth key, auto-joins tailnet)
- **Grafana Alloy** agent (auto-discovers all Docker containers)
- **UFW** firewall (22, 80, 443, 8443 + tailscale0)
- **deploy** user (docker + sudo groups)
- **Unattended upgrades**

## Deployment Flow (App)

```
GitHub Actions triggers Dagger VPS module (provision-and-deploy)
  -> Parse nextnode.toml config (regex-based in Dagger, smol-toml in shared lib)
  -> Resolve server tier (shared vs dedicated)
  -> Determine VPS name: custom-<app> (dedicated) or shared-<env> (shared)
  -> Determine TF Cloud workspace: nextnode-<app> (dedicated) or nextnode-shared-<env> (shared)
  -> Auto-create workspace if needed (TF Cloud API)
  -> Look up Cloudflare zone ID from domain (API)
  -> Look up Hetzner SSH key IDs (API)
  -> Generate ephemeral Tailscale auth key from OAuth credentials
  -> terraform plan (with TF_VAR_* — VPS + volume only, no DNS)
  -> terraform apply only if changes detected (skip if no diff)
  -> Read TF state outputs (VPS IP)
  -> DNS management (Dagger, via Cloudflare API):
     -> If no domain: skip DNS
     -> If internal: getTailscaleIp() via SSH → upsertDnsRecord(tailscaleIp, proxied=false)
     -> If public: upsertDnsRecord(vpsIp, proxied=true)
  -> Build .env: auto-inject ALL GitHub secrets (minus infra) + DOMAIN/PUBLIC_SITE_URL/APP_PORT
  -> Wait for SSH (up to 18 attempts, 10s intervals)
  -> Deploy: scp files + docker compose up -d --build (via SSH, namespaced in /opt/apps/<app>/)
```

### TF Cloud Workspaces

| Workspace | Contents |
|-----------|----------|
| `nextnode-shared-dev` | Shared dev VPS, Traefik (DNS managed by Dagger) |
| `nextnode-shared-prod` | Shared prod VPS, Traefik (DNS managed by Dagger) |
| `nextnode-monitoring` | Monitoring VPS + volume |
| `nextnode-<app>` | Per-app dedicated VPS + volume (DNS managed by Dagger) |

Workspaces are auto-created by Dagger (`ensureWorkspace()`). No manual bootstrap needed.

## Monitoring Stack

**Centralized monitoring VPS** (cpx21, nbg1) running:

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
- **Traefik ACME** — origin certs via Let's Encrypt DNS challenge (wildcard `*.nextnode.fr`)
- **Full (Strict) SSL mode** — origin cert validation required
- **Public apps** — orange cloud (Cloudflare proxied, CDN + DDoS protection)
- **Internal apps** — grey cloud (DNS points to Tailscale IP via `getTailscaleIp()`)
- **DNS ownership**: Dagger VPS module manages app DNS records via Cloudflare API (`upsertDnsRecord`). Terraform only manages environment-level DNS (zones, DNSSEC).
- **Cleanup**: `cleanupDns(domain, cloudflareToken)` deletes A records for an app domain

## GitHub Org Secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm package publishing |
| `HETZNER_API_TOKEN` | VPS provisioning |
| `CLOUDFLARE_API_TOKEN` | DNS/SSL management |
| `TF_CLOUD_TOKEN` | Terraform Cloud API (workspace mgmt + state) |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth — used by CI runner + generates ephemeral auth keys for new VPSes |
| `TS_OAUTH_SECRET` | Tailscale OAuth — paired with client ID |
| `VPS_SSH_KEY` | SSH private key for deploy user |
| `SLACK_BOT_TOKEN` | Slack notifications + alerts |
| `GRAFANA_API_KEY` | Grafana annotations API |

### GitHub Actions Variables (per-repo)

| Variable | Purpose |
|----------|---------|
| `PROD_REVIEWER_ID` | GitHub user ID of the required reviewer for prod deployments. Set via repo Settings → Variables. The `ensure-prod-environment` job auto-configures the `production` environment with this reviewer. |
