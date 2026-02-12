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
- **Dagger** (TypeScript SDK) — composable CI/CD modules for build, test, deploy
- **Terraform** — VPS provisioning (Hetzner) + DNS/SSL (Cloudflare)
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
type = "cpx21"                 # Hetzner server type
location = "nbg1"              # Hetzner datacenter
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

[environment.dev]
auto_deploy = true
pr_deploys = true

[environment.prod]
auto_deploy = false
approvers = ["walid"]

[rollback]
enabled = true
keep_versions = 5
```

### Server Tier Resolution

| Config Present | Dev VPS | Prod VPS |
|---------------|---------|----------|
| No `[server]` | Shared dev VPS | Shared prod VPS |
| `[server]` only | Dedicated (shared dev+prod) | Same dedicated VPS |
| `[server]` + `[environment.X.server]` | Dedicated (overridden) | Dedicated (overridden) |
| `[environment.X.server]` only | Dedicated dev | Dedicated prod |

## Pipeline Behavior

### Pipeline Workflow Files

The pipeline is split into three reusable workflows in `infrastructure/.github/workflows/`:

| File | Purpose |
|------|---------|
| `pipeline.yml` | Main entry — Plan, Lint, Test, Build, then dispatches to package or app workflow |
| `pipeline-package.yml` | Package-specific: Publish (semantic-release) + Canary Publish |
| `pipeline-app.yml` | App-specific: Deploy Dev → Deploy Prod |

### Per-repo CI file (identical in every repo)

**CRITICAL:** The caller workflow MUST declare `permissions` for semantic-release (package repos) or deployment (app repos) to work. Without it, `GITHUB_TOKEN` defaults to read-only and publish/deploy will fail with `EGITNOPERMISSION`.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: write       # semantic-release: push tags + changelog commits
  issues: write         # @semantic-release/github: create issues on failure
  pull-requests: write  # @semantic-release/github: comment on PRs

jobs:
  pipeline:
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    secrets: inherit
```

> **Why permissions in the caller?** With reusable workflows, `permissions` in the called workflow can only **restrict** the caller's permissions, not expand them. The caller must grant the ceiling.

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
| **App** | Lint -> Test -> Build -> Deploy dev -> [Manual approval] -> Deploy prod |

### Commit Convention

Uses **Conventional Commits** — semantic-release reads these to determine version bumps:
- `feat:` — minor version bump
- `fix:` — patch version bump
- `feat!:` or `BREAKING CHANGE:` — major version bump

## Dagger Modules

Seven TypeScript modules in `infrastructure/dagger-modules/`:

| Module | Key Functions | Purpose |
|--------|--------------|---------|
| **pipeline** | `plan()`, `lint()`, `test()`, `build()` | Reads nextnode.toml, outputs job matrix |
| **npm** | `publish()`, `canaryPublish()` | semantic-release with zero config in repos |
| **docker** | `build()`, `buildAndPush()` | Docker image build and GHCR push |
| **vps** | `provision()`, `deploy()`, `status()`, `rollback()` | Terraform provisioning + SSH deployment |
| **dns** | `verifyPropagation()`, `lookup()` | DNS verification (Terraform creates, Dagger verifies) |
| **secrets** | `inject()`, `verify()`, `rotate()` | SSH-based secret injection to VPS |
| **monitoring** | `deploy()`, `status()`, `annotate()`, `notifyDeploy()` | Monitoring stack + Grafana annotations |

### Dagger Module File Structure

Each module follows this exact layout (generated by `dagger develop`):

```
dagger-modules/<module>/
├── dagger.json              # Module manifest (name, sdk, source, engineVersion)
└── src/                     # Source root (matches dagger.json "source": "src")
    ├── .gitattributes       # Marks SDK as linguist-generated
    ├── .gitignore           # Excludes /sdk and node_modules
    ├── package.json         # ⚠️ Dependencies go HERE (not module root)
    ├── tsconfig.json        # TypeScript config for SDK
    ├── yarn.lock            # Lock file (generated by SDK)
    ├── sdk/                 # Auto-generated SDK (gitignored)
    └── src/
        └── index.ts         # ⚠️ ACTUAL MODULE CODE goes here
```

**Key gotchas:**
- Entry point is `src/src/index.ts` (source root + SDK convention), NOT `src/index.ts`
- Dependencies must be in `src/package.json`, not the module root `package.json`
- Run `dagger develop` after creating a new module to generate SDK artifacts
- The `dagger.json` SDK field uses object format: `"sdk": { "source": "typescript" }`

### GitHub Actions: dagger-for-github@v6

The `dagger-for-github@v6` action defaults to `verb: call` which runs bare `dagger call` — this fails in repos without `dagger.json`. **Always use `verb: version`** for install-only mode when running `dagger call` manually in a run step:

```yaml
- uses: dagger/dagger-for-github@v6
  with:
    version: "0.19.11"
    verb: version          # ← install-only, does NOT run dagger call
- name: Run Pipeline
  run: dagger call -m github.com/NextNodeSolutions/infrastructure/dagger-modules/pipeline plan ...
```

## Terraform Modules

Located in `infrastructure/terraform/`:

| Module | Provider | Resources |
|--------|----------|-----------|
| `modules/vps` | Hetzner | `hcloud_server`, `hcloud_firewall` |
| `modules/dns` | Cloudflare | `cloudflare_zone`, `cloudflare_dns_record`, `cloudflare_zone_dnssec` |
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
  -> Parse nextnode.toml [server] config
  -> Resolve server tier (shared vs dedicated)
  -> Determine TF Cloud workspace (nextnode-shared or nextnode-<app>)
  -> Auto-create workspace if needed (TF Cloud API)
  -> terraform plan (with app vars)
  -> terraform apply only if changes detected (skip if no diff)
  -> Read TF state outputs (VPS IP)
  -> Inject secrets via SSH (.env on VPS)
  -> Deploy: docker compose up -d (via SSH, namespaced in /opt/apps/<app>/)
  -> Annotate Grafana deployment dashboard
  -> Notify Slack #deployments
```

### TF Cloud Workspaces

| Workspace | Contents |
|-----------|----------|
| `nextnode-shared` | Shared dev + prod VPSes, Traefik, base DNS |
| `nextnode-monitoring` | Monitoring VPS + volume |
| `nextnode-<app>` | Per-app dedicated VPS + volume + DNS (on-demand) |

Workspaces are auto-created by Dagger. No manual bootstrap needed.

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
- **Internal apps** — grey cloud (DNS points to Tailscale IP)
- Terraform OWNS all DNS records (`prevent_destroy = true`)

## GitHub Org Secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm package publishing |
| `HETZNER_API_TOKEN` | VPS provisioning |
| `CLOUDFLARE_API_TOKEN` | DNS/SSL management |
| `TF_CLOUD_TOKEN` | Terraform Cloud API (workspace mgmt + state) |
| `TS_OAUTH_CLIENT_ID` | Tailscale ephemeral auth (CI runner) |
| `TS_OAUTH_SECRET` | Tailscale ephemeral auth (CI runner) |
| `TS_AUTH_KEY` | Tailscale auth key for new VPSes (cloud-init) |
| `VPS_SSH_KEY` | SSH private key for deploy user |
| `SLACK_BOT_TOKEN` | Slack notifications + alerts |
| `GRAFANA_API_KEY` | Grafana annotations API |

## Key Conventions

- **VPS naming:** `<app>-<tier>` (e.g., `plane-worker`, `monitoring`)
- **Domain pattern:** `<app>.nextnode.fr` (public) or `<app>.nextnode.fr` grey cloud (internal)
- **Branch strategy:** single `main` branch, PRs for development
- **No barrel exports** — direct imports only
- **Conventional Commits** required for semantic-release
- **Biome** for linting + formatting, **Vitest** for testing
- **pnpm** as package manager

## Cost Structure

| Component | Monthly |
|-----------|---------|
| Prod VPS (cpx22) | ~8EUR |
| Dev VPS (cx22) | ~4EUR |
| Monitoring VPS (cpx21) | ~6EUR |
| Hetzner Volumes (20GB) | ~1.60EUR |
| GitHub Actions | Free (public repos) |
| **Total** | **~20EUR** |

## Quick Reference: Adding a New App

1. Create repo in `NextnodeSolutions` org
2. Add `nextnode.toml` with `[project]`, `[routing]`, `[vps]`, `[deploy]` sections
3. Add `.github/workflows/ci.yml` (10-line reusable workflow caller)
4. Add `docker-compose.yml` and `Dockerfile`
5. Push to main — infrastructure auto-provisions VPS, DNS, deploys
6. Approve prod deployment in GitHub Actions when ready

## Quick Reference: Adding a New Package

1. Create repo in `NextnodeSolutions` org
2. Add `nextnode.toml` with `type = "package"`, `[package]` section
3. Add `.github/workflows/ci.yml` (10-line reusable workflow caller)
4. Use Conventional Commits — semantic-release handles versioning + publishing
5. Add `canary` label to PRs for pre-release testing

---

# NextNode Brand Guidelines

## Per-Project Branding Question (MANDATORY — ask ONCE per project)

When this skill auto-loads on a NextNode/SaaS project, **check if a `.nextnode-branding.json` file exists at the project root**. If it does NOT exist, you MUST ask the user the following question BEFORE doing any UI/frontend work:

> **Do you want to apply NextNode branding to this project?**

Use `AskUserQuestion` with these options:

| Option | Description |
|--------|-------------|
| **Full branding** | Typography + colors + logo — full NextNode identity |
| **Typography only** | Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono) + type scale — project picks its own colors |
| **Colors + typography** | NextNode palette + fonts — but no logo/icon integration |
| **No branding** | Project has its own identity — skip all NextNode brand rules |

After the user answers, create `.nextnode-branding.json` at the project root:

```json
{
  "level": "full" | "typography" | "colors-typography" | "none",
  "decidedAt": "2024-12-08"
}
```

On subsequent sessions, read the file and apply the chosen level silently. Never re-ask.

## Brand Identity

- **Name:** NextNode Solutions (EURL)
- **Tagline meaning:** Next = innovation, future / Node = connection, technical robustness
- **Values:** Technical excellence, transparency, human guidance, pragmatic innovation

## Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `teal-500` | `#0D9488` | Primary — CTAs, links, active states |
| `orange-500` | `#F97316` | Accent — highlights, secondary CTAs |
| `dark-navy` | `#141A30` | Dark mode backgrounds |

### Teal Scale

| Token | Hex |
|-------|-----|
| `teal-50` | Light teal (use Tailwind `teal-50`) |
| `teal-100` – `teal-400` | Intermediate steps (Tailwind defaults) |
| `teal-500` | `#0D9488` (primary) |
| `teal-600` | Hover states |
| `teal-700` | Dark teal |

### Background Tokens

| Context | Hex |
|---------|-----|
| Light page bg | `#F8FAFC` (slate-50) |
| Dark page bg | `#141A30` (dark navy) |
| Card dark bg | `#141A30` |
| Card light bg | `#F8FAFC` |

### Tailwind Config Mapping

When using Tailwind, extend the theme with:

```ts
colors: {
  brand: {
    teal: {
      DEFAULT: '#0D9488',
      50: '#F0FDFA',   // teal-50
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#0D9488',  // primary
      600: '#0F766E',
      700: '#115E59',
    },
    orange: {
      DEFAULT: '#F97316',
    },
    navy: '#141A30',
  },
}
```

## Typography

### Three Font Families

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **Display** | Plus Jakarta Sans | 600, 700, 800 | Hero titles, impact elements |
| **Body** | DM Sans | 400, 500, 600, 700 | All text content, navigation, buttons |
| **Code** | JetBrains Mono | 400, 500 | Code blocks, technical data |

### Type Scale

| Token | Size | Font |
|-------|------|------|
| Display | 48px | Plus Jakarta Sans 800 |
| H1 | 36px | Plus Jakarta Sans 700 |
| H2 | 28px | Plus Jakarta Sans 600 |
| Body | 16px | DM Sans 400 |
| Small | 14px | DM Sans 400 |

### Font Loading (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Tailwind Font Config

```ts
fontFamily: {
  display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
  sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
},
```

## Logo System

### SVG Assets Location

All original SVGs are at: `/Users/walid/Documents/NextNode/Branding/`

### Available Variants

| Folder | Files | Usage |
|--------|-------|-------|
| `icons/` | `icon-teal.svg`, `icon-white.svg`, `icon-black.svg` | Favicons, app icons, watermarks |
| `icons-text/` | `icon-text-{teal,white,black}.svg` | App icon with "NextNode" text below |
| `logos-square/` | `logo-square-{teal,white,black}.svg` | Social profiles, email signatures (400x400) |
| `logos-landscape/` | `logo-landscape-{teal,white,black}.svg` | Website headers, documents (500x100) |
| `logos-landscape/` | `logo-landscape-{teal,white,black}-short.svg` | Short version — "NextNode" only |
| `social/` | `avatar-dark.svg` (`#141A30` bg), `avatar-light.svg` (`#F8FAFC` bg) | Social media avatars |
| `favicon/` | `favicon.svg` | Browser favicon (32x32) |

### Gradient Specs

The NN symbol uses a **unified single-path SVG** with `gradientUnits="userSpaceOnUse"`.

| Variant | Gradient Stops |
|---------|---------------|
| **Teal** (primary) | `#5EEAD4` → `#14B8A6` → `#0D9488` |
| **White** (dark bg) | `#FFFFFF` → `#E2E8F0` → `#CBD5E1` |
| **Black** (print) | `#475569` → `#334155` → `#1E293B` |

### Context → File Quick Reference

| Context | File |
|---------|------|
| Website header | `logos-landscape/logo-landscape-teal.svg` |
| Favicon | `favicon/favicon.svg` |
| LinkedIn / Twitter | `social/avatar-dark.svg` |
| Email signature | `logos-landscape/logo-landscape-teal-short.svg` |
| App icon | `icons-text/icon-text-teal.svg` |
| Dark backgrounds | `-white` variants |
| Print / B&W | `-black` variants |

### Logo Rules

**DO:**
- Use original SVG files (copy from branding folder into project `public/` or `src/assets/`)
- Respect 25% clear space around the logo
- Choose the variant matching the background
- Maintain aspect ratio
- Use Black variant for B&W print

**DON'T:**
- Modify gradient colors
- Distort or stretch the logo
- Add effects (shadows, outlines)
- Place on low-contrast backgrounds
- Use below minimum sizes

### Minimum Sizes

| Context | Min Size |
|---------|----------|
| Favicon | 32x32px |
| Social | 48x48px |
| Header | 40px height |
| Print | 15x15mm |

## Branding Level Application Rules

Based on the `.nextnode-branding.json` `level` value:

| Level | Typography | Colors | Logo |
|-------|-----------|--------|------|
| `full` | Apply all 3 font families + type scale | Apply full teal/orange/navy palette | Copy appropriate SVGs into project |
| `colors-typography` | Apply all 3 font families + type scale | Apply full palette | Skip logo integration |
| `typography` | Apply all 3 font families + type scale | Project's own colors | Skip logo + palette |
| `none` | Skip entirely | Skip entirely | Skip entirely |
