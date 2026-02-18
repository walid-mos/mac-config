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
| `logger` | `@nextnode-solutions/logger` — logging library API and patterns | Yes (when in deps) |
| `email-manager` | `@nextnode-solutions/email-manager` — email sending library API | Yes (same dirs, conditional) |
| `nextnode-infra` | Infrastructure operations — CLI commands, Terraform, VPS, deployment, monitoring, DNS | No (manual `/nextnode-infra`) |
| `nextnode-standards` | Compliance audit — checks all standards and produces a report | Yes (same dirs) |
| `nextnode-brand` | Brand guidelines — colors, typography, logo system | No (manual `/nextnode-brand`) |
| `structure-astro` | Astro project `src/` structure — domain-driven components, shared/page separation, lib layer, islands | Yes (same dirs + clients) |

> **Keeping skills up to date:** Run `/learn` on any `@nextnode-solutions/*` package to update its skill. `/learn` cascades to dependent skills automatically.

---

## nextnode.toml — The Single Config File

Every NextNode/SaaS repo has a `nextnode.toml` at its root. This file drives ALL pipeline behavior — no other CI config is needed beyond the reusable workflow caller.

### Canonical Template

```toml
[project]
name = "my-app"                    # REQUIRED — no default. Used for naming everywhere.
type = "app"                       # REQUIRED — "app" | "package" | "monitoring"
description = "Description"        # Optional
domain = "app.nextnode.fr"         # App-only — subdomain for the app
redirect_domains = ["www.app.fr"]  # Optional — domains that 301→canonical (prod only, auto-adds www)

[scripts]                          # Defaults to pnpm lint/test/build
lint = "lint"                      # Set to false to skip lint step
test = "test"                      # Set to false to skip test step
build = "build"                    # Set to false to skip build step

# === App-only: Server (2 tiers) ===
# No [server] = shared dev + shared prod VPS (default)
[server]                           # Dedicated VPS (same for dev + prod)
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
migrations = "supabase/migrations" # Path to SQL migrations (relative, reserved)

[services.r2]                      # Cloudflare R2 object storage
bucket = "my-bucket"               # REQUIRED when [services.r2] is declared
public = false                     # Whether bucket has public access

[services.redis]                   # Redis sidecar
port = 6379                        # Redis port (default: 6379)

# === Per-Environment Config ===
[environment.dev]
enabled = true                     # Default: true — set false to skip dev deployment
cpu_limit = "0.25"                 # Docker CPU limit (default: 0.25)
memory_limit = "256M"              # Docker memory limit (default: 256M)

[environment.prod]
enabled = true                     # Default: true
cpu_limit = "1.0"                  # Default: 1.0
memory_limit = "1G"                # Default: 1G
cpu_reservation = "0.25"           # Guaranteed minimum CPU (default: 0.25)
memory_reservation = "256M"        # Guaranteed minimum memory (default: 256M)
```

### Server Tier Resolution

| Config Present | Dev VPS | Prod VPS |
|---------------|---------|----------|
| No `[server]` | Shared dev VPS (`nextnode-shared-dev`) | Shared prod VPS (`nextnode-shared-prod`) |
| `[server]` present | Dedicated VPS (`nextnode-{name}`) | Same dedicated VPS |

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
      - "${HOST_PORT}:${APP_PORT}"
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
- **Port mapping** — `${HOST_PORT}:${APP_PORT}` where `HOST_PORT` is CLI-assigned (10000-29999) and `APP_PORT` is from `nextnode.toml [deploy].port`

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
