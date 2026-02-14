---
name: nextnode-infra
description: NextNode infrastructure operations — CLI commands, Terraform, VPS provisioning, deployment, monitoring, and DNS/SSL. For repo compliance and nextnode.toml config, see the `nextnode` skill.
user-invocable: true
autoload-dirs: []
---

# NextNode Infrastructure Reference

> **`nextnode.toml` configuration** is documented in the `nextnode` skill (auto-loaded on all NextNode repos). This skill focuses on infrastructure operations.

## Architecture Overview

NextNode uses a **config-as-code driven, zero-manual-UI** infrastructure:

- **GitHub Actions** — CI/CD orchestration with a single reusable workflow
- **`infra` CLI** (TypeScript, citty) — CI/CD engine in `packages/cli/` — provision, deploy, destroy, rollback, build, lint, test, publish
- **Terraform 1.9** (TF Cloud backend) — VPS provisioning (Hetzner); DNS managed by CLI via Cloudflare API
- **Docker Compose** — app deployment on each VPS
- **Caddy** — native reverse proxy (xcaddy + Cloudflare DNS plugin), automatic SSL via ACME DNS-01 (HTTP-01 fallback)
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
| `infra deploy` | Deploy app to VPS via SSH + Docker Compose | `--sha` |
| `infra dns upsert` | Create/update DNS A record (+ wildcards) | `--ip` |
| `infra dns delete` | Delete DNS records for app | — |
| `infra dns list` | List DNS records for domain | — |
| `infra destroy` | Destroy VPS + cleanup (smart shared VPS handling) | `--app`, `--yes`, `--cleanup-workspace` |
| `infra rollback` | Rollback to a previous git ref | `--ref`, `--skip-build`, `--yes` |
| `infra status` | Check VPS, containers, DNS, Caddy health | `--json` |
| `infra pipeline` | Run full CI/CD pipeline (provision + DNS + deploy) | `--sha`, `--force`, `--skip-quality` |
| `infra publish` | Publish npm package (release or canary) | — |
| `infra validate` | Validate nextnode.toml configuration | — |

### CLI Libraries (`packages/cli/src/lib/`)

| Library | Key Functions |
|---------|---------------|
| **config** | `loadConfig()`, `computeHostPort()`, `computeEnvDomain()`, `computeWorkspaceName()`, `computeImageTag()`, `detectDockerConfig()` |
| **cloudflare** | `lookupZoneId()`, `upsertDnsRecord()`, `deleteDnsRecord()`, `listDnsRecords()` — with retry for rate limiting |
| **dns** | `resolveDnsTarget()`, `upsertWildcardRecords()`, `upsertRedirectDnsRecords()`, `deleteRedirectDnsRecords()` |
| **ssh** | `sshExec()`, `scp()`, `writeKeyFile()` — SSH via Tailscale hostnames |
| **terraform** | `terraformInit()`, `terraformPlan()`, `terraformApply()`, `terraformOutput()`, `terraformDestroy()` |
| **tfcloud** | `ensureWorkspace()`, `deleteWorkspace()`, `hasResources()` |
| **tailscale** | `deleteDevice()`, `generateAuthKey()`, `getDeviceIp()` — OAuth token caching |
| **caddy** | `generateHandleBlock()`, `generateBasicAuthBlock()`, `deployCaddyConfig()`, `removeCaddyAppConfig()`, `switchToReverseProxy()`, `switchToMaintenance()`, `sanitizeAppIdentifier()` |
| **compose-validation** | `validateCompose()` — check docker-compose.yml for common issues |
| **port-validation** | `validatePortConsistency()` — check compose port matches config |
| **docker** | `dockerBuild()`, `dockerPush()`, `dockerLogin()` |
| **github** | `verifyCiPassed()`, `getCheckRuns()` — prod gate CI verification |
| **hetzner** | `fetchHetznerSshKeyIds()` |
| **exec** | `exec()`, `execCapture()`, `requireBinary()` — process execution with logging |
| **logger** | `logger` (consola), `withTiming()` |
| **secrets** | `validateSecrets()`, `requireEnv()` |

### Key Config Types (`packages/cli/src/types/`)

```typescript
type ProjectType = "app" | "package" | "monitoring"
type PipelineAction = "ci" | "deploy-prod" | "destroy" | "force-redeploy" | "pr-preview"

interface ProjectConfig {
  project: { name: string; type: ProjectType; domain?: string; description?: string; redirect_domains?: string[] }
  scripts: { lint?: string; test?: string; build?: string }
  server?: { type: string; location: string; internal: boolean }
  volume: { enabled: boolean; size: number }
  deploy: { port: number; file?: string; hasCompose: boolean; zero_downtime: boolean }
  health: { type: "http" | "tcp"; path?: string; interval: string; timeout: string; retries: number }
  environment: { dev: { enabled: boolean }; prod: { enabled: boolean } }
  sablier?: { enabled: boolean; session_duration: string; display_name: string }
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

## Pipeline Behavior

### What Happens on PR

| Project Type | Actions |
|-------------|---------|
| **Package** | Lint -> Test -> Build (no publish) |
| **Package + canary label** | Lint -> Test -> Build -> Canary publish (`0.0.0-canary.<sha>`) |
| **App** | Lint -> Test -> Build |

### What Happens on Merge to Main

| Project Type | Actions |
|-------------|---------|
| **Package** | Lint -> Test -> Build -> publish (npm + GitHub Release) |
| **App** | Lint -> Test -> Build -> Provision -> DNS -> Deploy dev -> [Prod gate] -> Deploy prod |

### Workflow Architecture

```
ci.yml (per-repo template — see `nextnode` skill)
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
│   ├── vps/       # Hetzner VPS: hcloud_server, hcloud_firewall
│   └── volume/    # Hetzner volume: hcloud_volume (ext4, automount)
└── global/        # Cloudflare zone-level settings (zones, DNSSEC, SSL mode)
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

Every VPS is provisioned with **Debian 12** and auto-configured via `templates/cloud-init.yml`:

- **Docker** + docker-compose-plugin
- **Caddy** (built natively via xcaddy with Cloudflare DNS plugin)
- **Tailscale** (ephemeral auth key, auto-joins tailnet)
- **Sablier** (idle container auto-stop, custom NextNode waiting page)
- **Grafana Alloy** agent (auto-discovers all Docker containers)
- **fail2ban** for SSH protection
- **deploy** user (docker + sudo groups)
- **Automatic security updates**

## Deployment Flow (App)

```
GitHub Actions triggers CLI pipeline (infra pipeline --sha <sha>)
  -> Load and validate nextnode.toml (smol-toml + defu merge with defaults)
  -> Resolve server tier (shared vs dedicated)
  -> QUALITY GATE: lint, test, build, compose-validate, port-validate (parallel, unless --skip-quality)
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
     -> Upsert redirect domain DNS records (prod only, auto-www)
     -> Prod: proxied (orange cloud), Non-prod: unproxied (grey cloud)
     -> CNAME conflict detection and cleanup
  -> DEPLOY:
     -> Create /opt/apps/<app> on VPS
     -> Transform compose: replace build/image with GHCR tag, ensure caddy-net
     -> Generate .env (IMAGE, HOST_PORT, NODE_ENV, secrets, auto-vars)
     -> If zero_downtime: blue-green deploy (two slots, health check inactive slot before switch)
     -> Else: docker compose pull → up -d --remove-orphans
     -> Persist deploy state (.deploy-state JSON on VPS: activeSlot, imageTag, deployedAt)
     -> Configure Caddy (reverse proxy + optional basic_auth + optional Sablier)
     -> Health checks (container + HTTP)
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
- **Caddy ACME** — origin certs via Let's Encrypt DNS-01 challenge (Cloudflare DNS plugin), HTTP-01 fallback
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
