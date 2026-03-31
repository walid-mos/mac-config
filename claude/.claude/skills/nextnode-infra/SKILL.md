---
name: nextnode-infra
description: >-
  NextNode infrastructure context for any project using nextnode.toml. Reads
  project config and guides development, deployment, service integration,
  Docker Compose conventions, and environment management.
user-invocable: true
---

# NextNode Infrastructure

Provide infrastructure context and guidance for a project built on the NextNode platform. NextNode is a config-driven CI/CD system that handles VPS provisioning (Hetzner), deployment, DNS (Cloudflare), reverse proxy (Caddy), and service orchestration for containerized apps.

A project integrates with NextNode through two files: `nextnode.toml` (infrastructure config) and `docker-compose.yml` (service definitions). Everything else — port allocation, image builds, Caddy config, DNS records, health checks — is derived automatically from these two files.

## Arguments

- `task` (optional): Focus area. Examples:
  - `/nextnode` — Overview of this project's infrastructure setup
  - `/nextnode config` — Help with nextnode.toml configuration
  - `/nextnode services` — Service integration (Supabase, R2, Redis)
  - `/nextnode compose` — Docker Compose structure and conventions
  - `/nextnode deploy` — Deployment and CI/CD pipeline
  - `/nextnode env` — Environment variables and resolution
  - `/nextnode local` — Local development with `nn` CLI

## Instructions

### Phase 1: Read project context

Before answering, read the project's files to understand its setup:

1. **`nextnode.toml`** — Source of truth for infrastructure config. Always read this first.
2. **`docker-compose.yml`** (or `.yaml`) — Service definitions, build directives, port mappings.
3. **`Dockerfile`** (and variants like `Dockerfile.prod`) — Build context.
4. **`.env`**, **`.env.local`**, **`.nn/.env`** — Current environment variable state (if they exist).
5. **`CLAUDE.md`** or project-specific instruction files — For additional conventions.

If any file is missing, note it but continue with what's available.

### Phase 2: Provide context

Based on what you read and the user's task argument, provide relevant guidance. If no task was specified, give an overview:

- What type of project this is (app vs package)
- What services are enabled and their configuration
- How many buildable services exist in the compose file
- Route mappings (subdomain → service)
- Environment setup (dev, prod, PR previews)
- Any issues or misconfigurations you notice

Always anchor your guidance in the actual project files you read — don't give generic advice.

---

## Reference: nextnode.toml

### Required fields

```toml
[project]
name = "my-app"           # DNS, Docker images, VPS naming, workspace ID
type = "app"              # "app" (deployable) or "package" (npm-publishable)
domain = "myapp.com"      # Base domain — required for type = "app"
```

### Full schema with defaults

Every field below has a default in `nextnode.default.toml`. Only override what you need.

```toml
[project]
description = ""
redirect_domains = ["www.myapp.com"]   # 301-redirect to primary domain

[scripts]
lint = "lint"       # pnpm script name, or false to skip
test = "test"
build = "build"

[server]
type = "cpx22"      # Hetzner server type (cpx11, cpx22, cpx32, etc.)
location = "nbg1"   # Hetzner datacenter
internal = false    # true = Tailscale-only, no public DNS
# name = "my-vps"  # Use a named/shared VPS instead of dedicated

[volume]
enabled = false
size = 20           # GB

[deploy]
port = 4321         # App's internal listening port
zero_downtime = false  # Blue-green deployment (production only)
# file = "docker-compose.prod.yml"  # Override compose file

[health]
type = "http"       # "http" or "tcp"
path = "/health"
interval = "10s"
timeout = "10s"
retries = 3

[sablier]
enabled = true         # Auto-sleep for dev environments
session_duration = "15m"

[environment.development]
enabled = true
pr_previews = true
cpu_limit = "0.25"
memory_limit = "256M"

[environment.production]
enabled = true
cpu_limit = "1.0"
memory_limit = "1G"
cpu_reservation = "0.25"
memory_reservation = "256M"
```

### Multi-service routing

```toml
[[routes]]
subdomain = "api"
service = "backend"       # Must match a service name in docker-compose.yml
port = 8000
health_path = "/health"
```

Result: `api.myapp.com` (prod) / `api.dev.myapp.com` (dev) → `backend:8000`

### Services

```toml
[services.supabase]
enabled = true

[services.r2]
bucket = "my-assets"
public = true            # Enables CDN URL

[services.redis]
enabled = true
```

---

## Reference: Docker Compose

### Structure rules

- Services with `build:` = **buildable** — get Docker images built and pushed to ghcr.io
- Services without `build:` = **infrastructure** — databases, caches, sidecars (not transformed)
- Each buildable service needs a `Dockerfile` at its build context path

### Deploy-time transformations (AST-based, not regex)

| Source | Transformed to | Why |
|--------|---------------|-----|
| `build: .` | `image: ${IMAGE_MYSERVICE}` | Pre-built images from ghcr.io |
| `ports: ["3000:3000"]` | `ports: ["${HOST_PORT_MYSERVICE}:3000"]` | Deterministic host port avoids collisions |
| `deploy:` block | Removed | Replaced by resource limits from nextnode.toml |
| `NODE_ENV: production` | Removed | Injected at deploy time |

### Naming convention

Service names are normalized for env vars: **uppercase, hyphens → underscores**.
- `my-backend` → `IMAGE_MY_BACKEND`, `HOST_PORT_MY_BACKEND`

### Networks

All services get `caddy-net` + `default` networks injected at deploy time. Don't declare these manually.

---

## Reference: Environment Variables

### Auto-injected by services

**Supabase** (`[services.supabase]`):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | API URL (Kong gateway) |
| `SUPABASE_ANON_KEY` | Public anon JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT (server-side only) |
| `JWT_SECRET` | JWT signing secret |

**R2** (`[services.r2]`):

| Variable | Description |
|----------|-------------|
| `R2_BUCKET_NAME` | Bucket name |
| `R2_ENDPOINT_URL` | S3-compatible endpoint |
| `R2_CDN_URL` | Public CDN URL (if `public = true`) |
| `R2_ACCESS_KEY_ID` | Access key |
| `R2_SECRET_ACCESS_KEY` | Secret key |

**Redis** (`[services.redis]`):

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Connection string (`redis://...`) |

**Routes** (`[[routes]]`):
Each route auto-generates two URL env vars:

| Variable | Deploy | Local |
|----------|--------|-------|
| `INTERNAL_{SERVICE}_URL` | `http://backend:8000` (Docker DNS) | `http://localhost:8000` |
| `EXTERNAL_{SERVICE}_URL` | `https://api.dev.myapp.com` | `http://localhost:8000` |

**Always set**:
- `APP_URL` = primary domain URL (e.g., `https://dev.myapp.com`)
- `EXTERNAL_APP_URL` = same as `APP_URL` for deploy, `http://localhost:{port}` for local (auto-derived from `project.domain`)

### Precedence

Service-derived vars override `process.env`. If Supabase is enabled, `SUPABASE_URL` is computed — not read from env.

---

## Reference: Environments

| Environment | Short | Domain | Port range | Cloudflare proxy | Sablier |
|------------|-------|--------|------------|-----------------|---------|
| production | prod | `myapp.com` | 10000–19999 | Yes (Universal SSL) | No |
| development | dev | `dev.myapp.com` | 30000–39999 | No (Caddy LE certs) | Yes |
| PR preview | dev | `pr-{n}.dev.myapp.com` | 40000–49999 | No | Yes |
| Blue-green | prod | Same as prod | 20000–29999 | Yes | No |

**Container naming**: `{appName}` (prod), `{appName}-dev` (dev), `pr-{n}-{appName}` (PR).

**Port allocation**: Deterministic hash of app name → offset within range. Never hardcode ports.

**Cloudflare SSL limitation**: Universal SSL covers `*.myapp.com` only (one level). That's why `*.dev.myapp.com` uses Caddy Let's Encrypt (unproxied).

---

## Reference: Local Development (`nn` CLI)

```bash
nn up                     # Start all services + dev server
nn up --containerized     # Run app inside Docker too
nn up --reset             # Wipe all service data and restart
nn up --build             # Force container rebuild

nn down                   # Stop services
nn down --reset           # Stop + wipe data

nn env show               # Display resolved env vars
nn env check              # Verify required vars are set
nn env init               # Generate .env.local template
nn env push               # Push vars to deployment target
```

### Generated files (`.nn/` directory)

| File | Purpose |
|------|---------|
| `.nn/docker-compose.local.yml` | Generated compose file for local services |
| `.nn/.env` | Persistent service keys (JWT secrets, etc.) |
| `.nn/ports.json` | Allocated port mappings |
| `.nn/pid` | Dev server process ID |

These files are auto-generated. Don't edit them manually — they're overwritten on `nn up`.

---

## Reference: CI/CD Pipeline

### Standard flow (push to main/dev)

```
1. provision  → Ensure VPS exists (Hetzner + Terraform Cloud)
2. build      → Docker build each service → push to ghcr.io
3. deploy     → SSH to VPS → pull images → docker-compose up → configure Caddy
4. cleanup    → Remove old images, stale DNS records
```

### PR preview flow

```
PR opened/updated → Same pipeline with pr_number
  → Deploys to shared dev VPS
  → Creates pr-{n}.dev.domain.com
PR closed → Destroy containers + DNS records
```

### GitHub Actions

Projects use reusable workflows from the infrastructure repo. The pipeline is triggered by push events and orchestrated by the `pipeline` CLI command.

---

## Rules

1. **Never hardcode ports** — Port allocation is deterministic (hash-based). Use env vars or let the pipeline compute them.
2. **Never compare environment strings** — Don't write `env === 'production'`. Use `resolveEnv()` and access `env.identity.*`, `env.behavior.*`, `env.compute.*`.
3. **`process.env.KEY = undefined` sets the string `"undefined"`** — This is truthy. Use `""` or `delete process.env.KEY`.
4. **Caddy always uses `systemctl restart`** — Not `reload`. Reload doesn't restart crashed TLS listeners.
5. **Compose `build:` directives are replaced at deploy** — They become `image:` references. Don't rely on build args being available at runtime.
6. **Service env vars override process.env** — If Supabase is enabled, `SUPABASE_URL` is computed from the config, not read from the environment.
7. **`.nn/` directory is ephemeral** — Generated by `nn up`, wiped by `nn down --reset`. Don't store persistent data there.

## Gotchas

- **Sablier auto-sleep** — Dev containers hibernate after `session_duration` of inactivity. First request after sleep has latency while containers restart.
- **Deploy lock** — A lock file at `/var/lock/nextnode-deploy.lock` prevents concurrent deploys. 30-minute stale detection. If a deploy crashes, subsequent deploys may block until expiry.
- **Volume persistence** — `[volume]` must be enabled explicitly. Without it, container data is lost on redeploy.
- **Shared VPS collisions** — Multiple projects on a shared VPS are isolated by container name suffix and deterministic ports, but resource limits are per-service, not per-project.
- **Blue-green is production-only** — `zero_downtime = true` only works in production. Dev environments always do in-place replacement.
- **Redirect domains need DNS** — Adding `redirect_domains` in config doesn't create DNS records automatically. DNS must be provisioned separately.
