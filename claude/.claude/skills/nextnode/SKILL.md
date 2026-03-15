---
name: nextnode
description: NextNode ecosystem hub. Auto-load when working on any NextNode or SaaS project — covers nextnode.toml config, CI workflows, docker-compose rules, and cross-references to package skills.
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# NextNode Ecosystem Hub

This skill auto-loads on all NextNode/SaaS projects. It defines what a compliant repo looks like and references specialized skills for details.

## Related Skills

| Skill | Purpose | Auto-loads? |
|-------|---------|-------------|
| `standards` | `@nextnode-solutions/standards` — linting, formatting, TypeScript, Tailwind, testing, commit conventions | Yes (same dirs) |
| `logger` | `@nextnode-solutions/logger` — logging library API and patterns | Yes (same dirs; use when logger integration is relevant) |
| `email-manager` | `@nextnode-solutions/email-manager` — email sending library API | Yes (same dirs, conditional) |
| `nn` | `@nextnode-solutions/nn` — local dev DX CLI (nn up, nn env, nn down) | Yes (same dirs) |
| `nextnode-infra` | Infrastructure operations — infra CLI commands, Terraform, VPS, deployment, DNS | Yes (same dirs) |
| `nextnode-standards` | Compliance audit — checks all standards and produces a report | Yes (same dirs) |
| `nextnode-brand` | Brand guidelines — colors, typography, logo system | Yes (same dirs; applied during UI/frontend work) |
| `n8n-cli` | n8n workflow operations against the shared automation instance | Yes (same dirs) |
| `structure-astro` | Astro project `src/` structure — domain-driven components, shared/page separation, lib layer, islands | Yes (same dirs + clients) |
| `docker` | Docker standards — multi-stage builds, pnpm optimization, security hardening, nextnode.toml integration | Yes (when editing Docker files) |

> **Keeping skills up to date:** Run `/learn` on any `@nextnode-solutions/*` package to update its skill. `/learn` cascades to dependent skills automatically.

---

## nextnode.toml — The Single Config File

Every NextNode/SaaS repo has a `nextnode.toml` at its root. This file drives ALL pipeline behavior — no other CI config is needed beyond the reusable workflow caller.

### Canonical Template

```toml
[project]
name = "my-app"                    # REQUIRED — no default. Used for naming everywhere.
type = "app"                       # REQUIRED — "app" | "package"
description = "Description"        # Optional
domain = "app.nextnode.fr"         # App-only — subdomain for the app
redirect_domains = ["www.app.fr"]  # Optional — domains that 301→canonical (prod only, auto-adds www)

[scripts]                          # Defaults to pnpm lint/test/build
lint = "lint"                      # Set to false to skip lint step
test = "test"                      # Set to false to skip test step
build = "build"                    # Set to false to skip build step

# === App-only: Server (3 tiers) ===
# No [server] = shared dev + shared prod VPS (default)
[server]                           # Dedicated VPS (same for dev + prod)
name = "my-vps"                    # Named VPS — groups multiple apps onto the same custom VPS (optional)
project = "my-hetzner-project"     # Hetzner project — resolves to HETZNER_TOKEN_{PROJECT} secret (optional)
type = "cpx22"                     # Hetzner server type (default: cpx22)
location = "nbg1"                  # Hetzner datacenter (default: nbg1)
internal = false                   # true = grey cloud (Tailscale), false = orange cloud (public)

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

# === Services (all optional, app-only) ===
[services.supabase]                # Supabase self-hosted sidecar
studio_port = 54323                # Studio port on 127.0.0.1 (informational)
migrations = "supabase/migrations" # Path to SQL migrations (relative)
features = ["storage", "realtime"] # Optional features to enable
[services.supabase.oauth]          # OAuth provider config for GoTrue
providers = ["github", "google"]   # Provider names to enable
[services.supabase.oauth.github]   # Per-provider overrides (optional)
scopes = ["user:email"]
[services.supabase.versions]       # Pin specific service versions (optional)
postgres = "15.8.1.085"            # Override any service image tag

[services.r2]                      # Cloudflare R2 object storage
bucket = "my-bucket"               # REQUIRED. Resolved to {bucket}-{envShortId} per env (e.g., my-bucket-dev, my-bucket-prod)
public = false                     # Whether bucket has public access (enables r2.dev URL)
domain_cdn = true                  # Auto-derive CDN domain from project.domain (e.g., cdn.domain.fr)
domain_cdn_prefix = "cdn"          # Subdomain label for auto CDN domain (default: "cdn")
cdn = ["cdn.example.com"]          # Additional CDN bare hostnames (no protocol). Dev auto-prefixed (cdn.dev.example.com)

[services.redis]                   # Redis sidecar
port = 6379                        # Redis port (default: 6379)

# === Subdomain Routes (app-only, optional) ===
[[routes]]                         # Map subdomains to compose services
subdomain = "admin"                # e.g., admin.domain.fr (prod), admin.dev.domain.fr (dev)
service = "strapi"                 # docker-compose service name
port = 1337                        # container port
health_path = "/_health"           # optional health check path override

# === Per-Environment Config ===
[environment.development]
enabled = true                     # Default: true — set false to skip dev deployment
pr_previews = true                 # Default: true — PR preview deployments. Forced false when enabled=false.
cpu_limit = "0.25"                 # Docker CPU limit (default: 0.25)
memory_limit = "256M"              # Docker memory limit (default: 256M)

[environment.production]
enabled = true                     # Default: true
cpu_limit = "1.0"                  # Default: 1.0
memory_limit = "1G"                # Default: 1G
cpu_reservation = "0.25"           # Guaranteed minimum CPU (default: 0.25)
memory_reservation = "256M"        # Guaranteed minimum memory (default: 256M)
```

### Server Tier Resolution

| Config Present | Dev VPS | Prod VPS |
|---------------|---------|----------|
| No `[server]` | Shared dev VPS (`shared-dev`) | Shared prod VPS (`shared-prod`) |
| `[server]` (no name) | Dedicated VPS (`{project-name}`) | Same dedicated VPS |
| `[server]` + `name` | Named shared VPS (`nextnode-{name}`) — multi-tenant | Same named VPS |

---

## Per-Repo CI Files

**CRITICAL:** The caller workflow MUST declare `permissions` for the reusable workflow to function.

### 1. `.github/workflows/deploy-dev.yml` — Dev deploy pipeline

```yaml
name: Deploy Dev

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  checks: read
  contents: read
  packages: write

concurrency:
  group: deploy-dev-${{ github.ref }}
  cancel-in-progress: true

jobs:
  pipeline:
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    with:
      environment: dev
    secrets: inherit
```

### 2. `.github/workflows/deploy-prod.yml` — Manual production deploy

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

### 3. `.github/workflows/pr-preview.yml` — PR preview deploy + cleanup

```yaml
name: PR Preview

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, closed]

permissions:
  checks: read
  contents: read
  deployments: write
  packages: write
  pull-requests: write

concurrency:
  group: pr-preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  preview:
    if: github.event.action != 'closed'
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    with:
      action: pr-preview
      environment: dev
      pr_number: ${{ github.event.pull_request.number }}
    secrets: inherit

  cleanup:
    if: github.event.action == 'closed'
    uses: NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main
    with:
      action: pr-cleanup
      environment: dev
      pr_number: ${{ github.event.pull_request.number }}
    secrets: inherit
```

### How Workflows Map to Pipeline Actions

| Workflow | `action` | `environment` | Trigger |
|----------|----------|---------------|---------|
| `deploy-dev.yml` | `ci` (default) | `dev` (default) | push to main / manual |
| `deploy-prod.yml` | `deploy-prod` | `prod` | manual only |
| `pr-preview.yml` | `pr-preview` | `dev` | PR opened/synced |
| `pr-preview.yml` | `pr-cleanup` | `dev` | PR closed |

---

## docker-compose.yml Standard (Apps Only)

Caddy runs **natively on the VPS** — apps do NOT need a `proxy-public` external network.

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${HOST_PORT_APP}:${APP_PORT_APP}"
    restart: unless-stopped
    environment:
      - NODE_ENV=${NODE_ENV}
```

**Rules:**
- **No `proxy-public` network** — Caddy is native, reaches app via host port mapping
- **No `env_file`** — use `environment` block. CLI injects all env vars into `.env` at deploy time
- **No `container_name`** — let Docker Compose auto-name
- **No inline `healthcheck`** — put health checks in `Dockerfile` (`HEALTHCHECK` instruction)
- **`restart: unless-stopped`** — standard restart policy
- **Port mapping** — `${HOST_PORT_APP}:${APP_PORT_APP}` where `HOST_PORT_APP` is CLI-assigned (10000-29999) and `APP_PORT_APP` is from `nextnode.toml [deploy].port`. Every buildable service uses `${HOST_PORT_<SERVICE>}:${APP_PORT_<SERVICE>}` (SERVICE = uppercased name, hyphens → underscores)

---

## Commit Convention

Uses **Conventional Commits** — semantic-release reads these to determine version bumps:
- `feat:` — minor version bump
- `fix:` — patch version bump
- `feat!:` or `BREAKING CHANGE:` — major version bump

---

## Formatting Rules for Code Generation

When generating or editing code in any NextNode project, follow the formatting rules defined in the `standards` skill (section "Formatting Rules for Code Generation"). Key points:

- **Indentation:** tabs (width 4)
- **Semicolons:** none
- **Quotes:** single quotes (double in JSX)
- **Trailing commas:** always (except JSON)
- **Arrow parens:** avoid
- **Import order:** side-effect > builtin > external > internal > parent > sibling > index
- **Type imports:** always use `import type` (separate, top-level)

See the `standards` skill for the complete list.
