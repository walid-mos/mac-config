---
name: docker
description: "Docker standards for Node.js/pnpm apps. Auto-load when writing or reviewing Dockerfiles, .dockerignore, or docker-compose files."
user-invocable: false
autoload-when-editing:
  - "**/Dockerfile"
  - "**/Dockerfile.*"
  - "**/.dockerignore"
  - "**/docker-compose*.yml"
  - "**/docker-compose*.yaml"
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# Docker Standards

Auto-loads when writing or reviewing any Docker-related file. Every rule is mandatory — no exceptions.

---

## 1. Foundational Rules

1. **Multi-stage builds ALWAYS** — minimum 2 stages: `builder` + `runtime`. No single-stage production Dockerfiles.
2. **`# syntax=docker/dockerfile:1`** on line 1 of every Dockerfile — unlocks BuildKit features (cache mounts, secret mounts, heredocs).
3. **`node:XX-slim`** (Debian) as base — NOT full `node:XX`, NOT `alpine` (musl breaks native modules silently). Exception: pure JS apps with zero native deps MAY use `alpine` if explicitly justified.
4. **Never hardcode pnpm version** — use `corepack prepare --activate` (reads `packageManager` from `package.json`). NEVER `corepack prepare pnpm@X.Y.Z --activate`.
5. **`--frozen-lockfile`** on every `pnpm install` — no exceptions.
6. **`pnpm.onlyBuiltDependencies`** MUST be set in `package.json` — this is the allowlist of packages permitted to run install scripts (e.g. `better-sqlite3`, `esbuild`, `sharp`). Everything else is blocked by default in pnpm v10+. NEVER use `--ignore-scripts` (breaks native module builds), `HUSKY=0`, `CI=true`, or any inline env hack. `husky` is excluded from the allowlist, so its `prepare` script never runs in Docker — no hack needed.
7. **Exec form ALWAYS** for `CMD` and `ENTRYPOINT` — `CMD ["node", "dist/server.js"]`, never `CMD node server.js`.
8. **Non-root user** in the runtime stage — switch with `USER` before `CMD`.
9. **Signal handler (tini or dumb-init)** as PID 1 — Node.js must not run as PID 1.
10. **HEALTHCHECK instruction** in the Dockerfile — never in `docker-compose.yml`.

---

## 2. nextnode.toml Integration

When a project uses `nextnode.toml` (NextNode ecosystem), Docker config MUST derive values from it — never hardcode what the infrastructure manages.

### Managed Variables

These are injected by the NextNode CLI at deploy time — the Dockerfile uses `ARG`/`ENV` for them:

| Variable | Source | Usage in Dockerfile |
|----------|--------|---------------------|
| `APP_PORT` | `[deploy].port` in `nextnode.toml` | `ARG APP_PORT=<default>` + `EXPOSE $APP_PORT` |
| `HOST_PORT_APP` | CLI-assigned (10000-29999) | docker-compose only: `${HOST_PORT_APP}:${APP_PORT_APP}` |
| `NODE_ENV` | CLI-injected | `ENV NODE_ENV=production` in runtime stage |
| `HOST` | Always `0.0.0.0` for containers | `ENV HOST=0.0.0.0` |

### Port Consistency Rule

The `EXPOSE` port, the `ENV PORT`, and the app's listening port MUST all match `[deploy].port` from `nextnode.toml`. Use an `ARG` with the toml value as default:

```dockerfile
ARG APP_PORT=4321
ENV PORT=$APP_PORT
EXPOSE $APP_PORT
```

### docker-compose.yml Rules (nextnode ecosystem)

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

> Multi-build: every service with `build:` gets `${HOST_PORT_<SERVICE>}:${APP_PORT_<SERVICE>}`. SERVICE = uppercased name, hyphens → underscores.

- **No `env_file`** — CLI injects `.env` at deploy time
- **No `container_name`** — let Compose auto-name
- **No `proxy-public` network** — Caddy runs natively on VPS
- **No inline `healthcheck`** — belongs in Dockerfile
- **`restart: unless-stopped`** always

### Resource Limits

When `[environment.*]` defines `cpu_limit`/`memory_limit`, apply in compose:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "${CPU_LIMIT:-0.25}"
          memory: "${MEMORY_LIMIT:-256M}"
        reservations:
          cpus: "${CPU_RESERVATION:-0.1}"
          memory: "${MEMORY_RESERVATION:-128M}"
```

---

## 3. Layer Ordering (Stable → Volatile)

Order instructions from what changes LEAST to what changes MOST. A changed layer invalidates all subsequent layers.

```
1. FROM base image            (changes: on security patches)
2. System packages            (changes: rarely)
3. corepack enable            (changes: never)
4. WORKDIR                    (changes: never)
5. Non-root user creation     (changes: never)
6. pnpm-lock.yaml COPY       (changes: when deps change)
7. pnpm fetch                 (changes: when lockfile changes)
8. package.json COPY          (changes: slightly more often)
9. pnpm install               (changes: when deps change)
10. Source files COPY         (changes: every build)
11. Build command             (changes: every build)
12. Runtime COPY --from=build (changes: every build)
13. ENV / LABEL / HEALTHCHECK (changes: rarely)
14. USER                      (changes: never)
15. ENTRYPOINT / CMD          (changes: rarely)
```

**Critical mistakes:**
- NEVER `COPY . .` before `pnpm install` — causes full reinstall on every source change
- NEVER split `apt-get update && apt-get install` across two `RUN` layers — the apt cache layer goes stale

---

## 4. Build Time Optimization

### 4.1 pnpm fetch + offline install (cache-optimal pattern)

```dockerfile
# Lockfile alone — pnpm fetch only needs this file
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

# Now install from pre-populated store — no network
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
```

Why: `pnpm fetch` only reads `pnpm-lock.yaml`. Adding a script to `package.json` (without changing deps) does NOT bust this cache layer.

### 4.2 Parallel stages for prod/build deps

BuildKit runs independent stages concurrently:

```dockerfile
FROM fetch AS prod-deps
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --offline

FROM fetch AS build
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
COPY . .
RUN pnpm build
```

`prod-deps` and `build` execute in parallel — total build time is max(stage A, stage B), not sum.

### 4.3 BuildKit cache mounts

Always use `--mount=type=cache` for package managers:

```dockerfile
# pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

# apt (needs sharing=locked)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*
```

### 4.4 Selective COPY (not COPY . .)

Copy only what the build needs — prevents cache busting from unrelated file changes:

```dockerfile
# Build stage — copy only build inputs
COPY tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN pnpm build
```

### 4.5 CI registry cache

For CI (ephemeral runners), use registry-backed cache:

```bash
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/org/app:buildcache \
  --cache-to   type=registry,ref=ghcr.io/org/app:buildcache,mode=max \
  --tag ghcr.io/org/app:latest \
  --push .
```

`mode=max` exports ALL intermediate layers — critical for multi-stage cache hits.

---

## 5. Image Size Optimization

### 5.1 Base image: `node:XX-slim`

| Base | Size | CVEs | Shell | Recommendation |
|------|------|------|-------|----------------|
| `node:22` | ~1 GB | High | Yes | NEVER in production |
| `node:22-slim` | ~220 MB | Low | Yes | Default choice |
| `node:22-alpine` | ~55 MB | Very low | sh | Only pure JS apps |
| `distroless/nodejs22` | ~100 MB | Near zero | No | Maximum security |

### 5.2 Production-only node_modules

ALWAYS use `--prod` in the runtime install or copy from a dedicated prod-deps stage:

```dockerfile
COPY --from=prod-deps /app/node_modules ./node_modules
```

NEVER ship devDependencies to production.

### 5.3 Copy ONLY runtime artifacts

```dockerfile
# Runtime stage receives ONLY:
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# NEVER copy: src/, tsconfig.json, test files, docs, .git
```

### 5.4 Clean up in the SAME RUN layer

```dockerfile
# CORRECT — single layer, no bloat
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# WRONG — rm runs in new layer, old layer still has cache
RUN apt-get install -y tini
RUN rm -rf /var/lib/apt/lists/*
```

### 5.5 Always `--no-install-recommends`

Prevents apt from pulling suggested packages — cuts installed size 30-50%.

### 5.6 Strip SUID/SGID bits

```dockerfile
RUN find / -type f -perm /6000 -exec chmod -s {} \; 2>/dev/null || true
```

Removes setuid/setgid binaries that could enable privilege escalation.

---

## 6. Security Hardening

### 6.1 Non-root user (MANDATORY)

```dockerfile
# Debian slim
RUN groupadd -g 1001 appgroup \
    && useradd -u 1001 -g appgroup --no-log-init --create-home appuser

# Alpine
RUN addgroup -g 1001 -S appgroup \
    && adduser -S -u 1001 -G appgroup appuser
```

Use `COPY --chown=appuser:appgroup` to set ownership at copy time — cheaper than a separate `RUN chown`.

Switch to non-root AFTER all file operations, BEFORE CMD:

```dockerfile
USER appuser
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "dist/server.js"]
```

### 6.2 No secrets in layers (MANDATORY)

```dockerfile
# WRONG — visible in docker history
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc

# CORRECT — ephemeral, never in any layer
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile
```

Rules:
- NEVER use `ARG` or `ENV` for secrets
- NEVER `COPY .npmrc` then `RUN rm .npmrc` — the file exists in the intermediate layer
- Use `--mount=type=secret` for private registries, tokens, credentials

### 6.3 COPY over ADD

Always use `COPY` for local files. `ADD` is only acceptable for auto-extracting tar archives with checksum validation.

### 6.4 Signal handling with tini

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "dist/server.js"]
```

On Alpine: `RUN apk add --no-cache tini` → `/sbin/tini`.

### 6.5 Health check (MANDATORY for apps)

Use Node.js built-in HTTP — never install `curl` just for health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:' + (process.env.PORT || 4321) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
```

Parameters:
- `--start-period`: set to actual app startup time (grace before failures count)
- `--interval`: 30s is standard
- `--retries`: 3 before marking unhealthy

### 6.6 Read-only filesystem at runtime

Enforce in compose or `docker run`:

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m
```

### 6.7 Drop capabilities

```yaml
services:
  app:
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

### 6.8 OCI labels

```dockerfile
ARG BUILD_DATE
ARG VCS_REF
ARG APP_VERSION

LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.source="https://github.com/org/app" \
      org.opencontainers.image.title="App Name" \
      org.opencontainers.image.licenses="MIT"
```

---

## 7. Canonical Dockerfile — Single App (pnpm)

```dockerfile
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG APP_PORT=4321

# ── Base ─────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS base
RUN corepack enable && corepack prepare --activate
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
WORKDIR /app

# ── Fetch ────────────────────────────────────────────────
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

# ── Prod deps ────────────────────────────────────────────
FROM fetch AS prod-deps
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --offline

# ── Build ────────────────────────────────────────────────
FROM fetch AS build
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
COPY tsconfig*.json ./
COPY src/ ./src/
RUN pnpm build

# ── Runtime ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 appgroup \
    && useradd -u 1001 -g appgroup --no-log-init --create-home appuser

WORKDIR /app

COPY --chown=appuser:appgroup --from=prod-deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=build /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

ARG APP_PORT
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=${APP_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:' + (process.env.PORT || 4321) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

EXPOSE ${APP_PORT}

USER appuser

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "dist/server.js"]
```

### Astro SSR Variant

Replace the CMD and add Astro-specific env:

```dockerfile
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=${APP_PORT} \
    ASTRO_TELEMETRY_DISABLED=1

CMD ["node", "dist/server/entry.mjs"]
```

### Apps with build-time public env vars (Vite/Astro)

When `PUBLIC_*` vars must be inlined at build time:

```dockerfile
FROM fetch AS build
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

# PUBLIC_ vars inlined by Vite at build time
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG PUBLIC_SITE_URL
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL \
    PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL

COPY tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN pnpm build
```

These are NOT secrets — they are public client-side values embedded in the JS bundle.

### Apps with native modules (better-sqlite3, sharp, etc.)

**Prerequisite:** `package.json` MUST declare `pnpm.onlyBuiltDependencies` — this is the allowlist of packages permitted to run install/build scripts. Without it, pnpm v10+ blocks all lifecycle scripts by default.

```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "better-sqlite3",
      "esbuild",
      "sharp"
    ]
  }
}
```

When native addons need compilation tools, install them in the **builder stage only**:

```dockerfile
FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
# ... rest of build stage
# These packages are NOT in the runtime stage
```

`--ignore-scripts` is NEVER needed — `onlyBuiltDependencies` handles script control declaratively. Using `--ignore-scripts` would override the allowlist and break native module compilation.

---

## 8. Canonical Dockerfile — Monorepo (Turborepo + pnpm)

```dockerfile
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG APP_PORT=3000

# ── Base ─────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS base
RUN corepack enable && corepack prepare --activate
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
WORKDIR /app

# ── Fetch ────────────────────────────────────────────────
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

# ── Install + Build ─────────────────────────────────────
FROM fetch AS build
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

COPY . .
RUN pnpm turbo build

# ── Prod deps ────────────────────────────────────────────
FROM fetch AS prod-deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --offline

# ── Runtime ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 appgroup \
    && useradd -u 1001 -g appgroup --no-log-init --create-home appuser

WORKDIR /app

COPY --chown=appuser:appgroup --from=prod-deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=appuser:appgroup --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --chown=appuser:appgroup --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=appuser:appgroup --from=build /app/apps/web/dist ./apps/web/dist
COPY --chown=appuser:appgroup --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --chown=appuser:appgroup package.json ./

ARG APP_PORT
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=${APP_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

EXPOSE ${APP_PORT}

USER appuser

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "apps/api/dist/index.js"]
```

**Monorepo alternative — `pnpm deploy`:** For cleaner isolation, use `pnpm deploy --filter=api --prod /prod/api` to extract a single workspace with only its production deps into an isolated directory.

---

## 9. Canonical .dockerignore

Every project with a Dockerfile MUST have a `.dockerignore`:

```
# Version control
.git
.gitignore
.gitattributes
.github/

# Dependencies (rebuilt inside container)
node_modules/
.pnpm-store/

# Build artifacts (rebuilt inside container)
dist/
build/
.astro/
.next/
.nuxt/
out/

# TypeScript cache
*.tsbuildinfo

# Test output
coverage/
.nyc_output/

# Logs
*.log
pnpm-debug.log*

# Environment (NEVER in image)
.env
.env.*
!.env.example
.envrc

# Credentials (NEVER in image)
.npmrc
*.pem
*.key

# Editor/OS
.vscode/
.idea/
.DS_Store
*.swp

# Documentation
*.md
docs/
LICENSE
CHANGELOG

# Claude / AI
.claude/

# Docker files (already in context)
Dockerfile
Dockerfile.*
.dockerignore
docker-compose*.yml
docker-compose*.yaml
```

---

## 10. Anti-Patterns (NEVER DO)

| # | Anti-Pattern | Correct Approach |
|---|-------------|------------------|
| 1 | `corepack prepare pnpm@X.Y.Z --activate` | `corepack prepare --activate` — reads `packageManager` from `package.json` |
| 2 | `--ignore-scripts` / `HUSKY=0` / `ENV CI=true` | `pnpm.onlyBuiltDependencies` allowlist in `package.json` — blocks all scripts except listed packages |
| 3 | `COPY . .` before `pnpm install` | Copy `pnpm-lock.yaml` first, then `package.json`, then install, then source |
| 4 | `CMD npm start` or `CMD pnpm start` | `CMD ["node", "dist/server.js"]` — exec form, direct node invocation |
| 5 | Running as root in production | Create dedicated user, `USER appuser` before CMD |
| 6 | Node.js as PID 1 | `ENTRYPOINT ["/usr/bin/tini", "-g", "--"]` |
| 7 | Installing curl just for HEALTHCHECK | Use `node -e "require('http')..."` |
| 8 | `ADD` for local files | `COPY` always — `ADD` only for tar extraction |
| 9 | `ARG NPM_TOKEN` for secrets | `--mount=type=secret,id=npmrc,target=/root/.npmrc` |
| 10 | Separate `RUN apt-get update` and `RUN apt-get install` | Single `RUN` with `&&` — prevents stale apt cache |
| 11 | Missing `.dockerignore` | Always create — prevents sending `.git`, `node_modules`, `.env` to daemon |
| 12 | `EXPOSE 4321` with hardcoded value | `ARG APP_PORT=4321` + `EXPOSE ${APP_PORT}` |
| 13 | `RUN chown -R user:group /app` as separate layer | `COPY --chown=user:group` at copy time |
| 14 | Full `node:22` as runtime base | `node:22-slim` — 1 GB vs 220 MB |
| 15 | `pnpm install` without `--offline` after `pnpm fetch` | Always `--offline` after fetch — guarantees no network, faster |
| 16 | Copying devDependencies to runtime | Use `--prod` on install or separate prod-deps stage |
| 17 | Missing `# syntax=docker/dockerfile:1` | Always first line — enables cache mounts, secret mounts |
| 18 | `pnpm install` without `--frozen-lockfile` | Always `--frozen-lockfile` — deterministic builds |

---

## 11. Review Checklist

When reviewing any Dockerfile, verify ALL of the following:

**Structure:**
- [ ] `# syntax=docker/dockerfile:1` on line 1
- [ ] Multi-stage build (minimum: build + runtime)
- [ ] `node:XX-slim` base (or justified alpine)
- [ ] `corepack prepare --activate` (no version pinning)

**Build optimization:**
- [ ] pnpm fetch + offline pattern (lockfile-only cache)
- [ ] BuildKit cache mounts on pnpm install (`--mount=type=cache`)
- [ ] Selective COPY (not `COPY . .` before install)
- [ ] Layer ordering: stable → volatile
- [ ] Parallel stages where possible (prod-deps || build)

**Size optimization:**
- [ ] Prod-only `node_modules` in runtime
- [ ] Only `dist/` + `node_modules/` + `package.json` in runtime
- [ ] `--no-install-recommends` on apt-get
- [ ] Cleanup in same `RUN` layer as install

**Security:**
- [ ] Non-root user with explicit UID/GID
- [ ] `COPY --chown` instead of `RUN chown`
- [ ] No secrets in ARG/ENV/COPY
- [ ] `COPY` over `ADD`
- [ ] tini or dumb-init as ENTRYPOINT
- [ ] SUID/SGID bits stripped (optional but recommended)
- [ ] `pnpm.onlyBuiltDependencies` set in `package.json` (NO `--ignore-scripts`)

**Runtime:**
- [ ] Exec form CMD/ENTRYPOINT
- [ ] HEALTHCHECK defined (apps)
- [ ] `NODE_ENV=production`
- [ ] `EXPOSE` matches `[deploy].port` from `nextnode.toml`
- [ ] OCI labels present

**Files:**
- [ ] `.dockerignore` exists and excludes `.git`, `node_modules`, `.env`, `.npmrc`
