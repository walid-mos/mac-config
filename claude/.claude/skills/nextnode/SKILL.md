---
name: nextnode
description: NextNode project hub. Auto-load when working on any NextNode or SaaS project — dynamic project discovery, conventions, and quick references.
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# NextNode Project Hub

Lightweight hub that auto-loads on every NextNode/SaaS project. For detailed references, see sibling skills:
- **`/nextnode-infra`** — CI/CD pipeline, Dagger modules, Terraform, VPS, monitoring, DNS/SSL
- **`/nextnode-brand`** — color palette, typography, logos, branding rules
- **`/email-manager`** — template-first email sending with React Email (auto-loaded when `@nextnode-solutions/email-manager` is in `package.json`)

## Project Discovery (Dynamic)

When this skill auto-loads, Claude MUST dynamically discover all local projects by scanning the two development directories. **Never maintain a hardcoded project list** — always discover at runtime.

### Discovery procedure

1. **List subdirectories** in `/Users/walid/Development/nextnode/` and `/Users/walid/Development/saas/` (skip hidden dirs, `node_modules`, `docs`)
2. **For each subdirectory**, read whichever of these files exist (in parallel for speed):
   - `package.json` — extract `name`, `version`, `description`, `dependencies`, `devDependencies`
   - `nextnode.toml` — extract `[project]` (name, type, domain) and `[package]` (scope, access)
3. **Build a mental registry** of every discovered project with:
   - **Directory path** — absolute path to the repo
   - **Package name** — from `package.json` `name` field (e.g. `@nextnode-solutions/standards`, `@nextnode/logger`)
   - **Project type** — `package` or `app` (from `nextnode.toml` or inferred from `package.json`)
   - **Key deps** — notable dependencies that hint at the project's tech stack

### When to run discovery

- **On first relevant question** — when the user asks about a project, references a package name, or needs cross-repo context
- **When resolving imports** — if the user references `@nextnode/*` or `@nextnode-solutions/*`, discover which local repo provides that package
- **When checking compatibility** — to find which projects depend on a package being modified

### How to use the registry

- **Cross-reference dependencies:** when editing a package, check which other local projects consume it
- **Resolve local packages:** map `@nextnode/logger` to `/Users/walid/Development/nextnode/logger/` etc.
- **Suggest impact:** when changing a shared package, list local consumers that may be affected
- **Navigate quickly:** when the user says "go to the logger" or "check infrastructure", resolve to the right directory

## Key Conventions

- **VPS naming:** `<app>-<tier>` (e.g., `plane-worker`, `monitoring`)
- **Domain pattern:** `<app>.nextnode.fr` (public) or `<app>.nextnode.fr` grey cloud (internal)
- **Branch strategy:** single `main` branch, PRs for development
- **No barrel exports** — direct imports only
- **Conventional Commits** required for semantic-release
- **@nextnode-solutions/standards** — MANDATORY in every project (oxlint + oxfmt + TypeScript + Tailwind + Vitest + commitlint). See `/standards` skill for full details.
- **pnpm ONLY** — ALWAYS use `pnpm`, NEVER `npm` or `yarn`. This applies to all commands: install, add, remove, run, exec, dlx, etc.

## Default Scripts

All NextNode projects use these standard pnpm scripts unless the project's `CLAUDE.md` explicitly overrides them:

| Command        | Purpose          |
|----------------|------------------|
| `pnpm lint`    | Lint the codebase |
| `pnpm test`    | Run tests         |
| `pnpm build`   | Build the project |
| `pnpm dev`     | Start dev server  |

> **Override rule:** If the project's `CLAUDE.md` defines different script names or flags, use those instead. The project-level `CLAUDE.md` always takes precedence.

## Full App Compliance Kit

When creating a new app OR updating an existing app to respect NextNode standards, **all items below are mandatory**. Use this as a checklist — every item must be present and correctly configured.

### 1. `nextnode.toml` — Project Config (root of repo)

Only `[project]` is required. All other sections have sensible defaults and are optional.

```toml
# === REQUIRED ===
[project]
name = "<app-name>"               # Required — kebab-case, used everywhere
type = "app"                      # Required — "app" or "package"
domain = "<app>.nextnode.fr"      # Required for apps — subdomain
description = "<description>"     # Optional

# === ALL BELOW ARE OPTIONAL (defaults shown) ===

# [scripts]                       # Default: lint = "lint", test = "test", build = "build"
# [deploy]                        # Default: strategy = "docker-compose", file = "docker-compose.yml",
#                                 #   dockerfile = "./Dockerfile", context = "./", port = 4321
# [health]                        # Default: none — add if you want health checks
# [environment.dev]               # Default: auto_deploy = true, pr_deploys = true
# [environment.prod]              # Default: auto_deploy = false, approvers = ["walid"]
# [rollback]                      # Default: enabled = true, keep_versions = 5
```

**Minimal `nextnode.toml` for a typical app:**

```toml
[project]
name = "my-app"
type = "app"
domain = "my-app.nextnode.fr"
```

> Only add sections when you need to override defaults. For server tiers, volume config, and advanced options see `/nextnode-infra` skill.

### 2. `docker-compose.yml`

```yaml
services:
  app:
    build:
      context: .
      # Add build args here if PUBLIC_ vars are needed at build time (Vite/Astro)
      # args:
      #   PUBLIC_SITE_URL: ${PUBLIC_SITE_URL}
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=${APP_PORT:-4321}
    ports:
      - "${APP_PORT:-4321}:${APP_PORT:-4321}"
    restart: unless-stopped
```

> Add `build.args` for any `PUBLIC_*` env vars that must be inlined at build time (Vite/Astro). Runtime-only secrets go only in `env_file` / `environment`.

### 3. `Dockerfile` — Multi-Stage Production Build

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=24
ARG PNPM_VERSION=10
ARG APP_PORT=4321

# --- Build stage ---
FROM node:${NODE_VERSION}-alpine AS builder

RUN apk update && apk upgrade && \
    apk add --no-cache python3 make g++ && \
    rm -rf /var/cache/apk/* /tmp/*

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

RUN addgroup -g 1001 -S app && \
    adduser -S app -u 1001 && \
    chown app:app /app

USER app

COPY --chown=app:app package.json pnpm-lock.yaml ./

ENV HUSKY=0 CI=true NODE_ENV=production

RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source — adapt to your project structure
COPY --chown=app:app src ./src/
# COPY --chown=app:app public ./public/
# COPY --chown=app:app astro.config.mjs tsconfig.json ./

RUN pnpm run build && \
    pnpm prune --prod && \
    rm -rf node_modules/.cache .astro node_modules/.pnpm .pnpm-store

# --- Runtime stage ---
FROM node:${NODE_VERSION}-alpine AS runtime

RUN apk update && apk upgrade && \
    apk add --no-cache tini ca-certificates && \
    rm -rf /var/cache/apk/* /tmp/* && \
    addgroup -g 1001 -S app && \
    adduser -S app -u 1001 -G app && \
    mkdir -p /app && chown app:app /app

ARG APP_PORT
ENV NODE_ENV=production HOST=0.0.0.0 PORT=${APP_PORT}

WORKDIR /app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./package.json

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT:-4321}',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

EXPOSE $APP_PORT

ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["node", "--enable-source-maps", "./dist/server/entry.mjs"]
```

> **Adapt the COPY lines and CMD** to your framework (Astro, Next.js, etc.). The structure above covers the common Astro SSR case.

### 4. `.github/workflows/ci.yml` — Reusable Pipeline

```yaml
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

> **This is the ONLY CI file needed.** All logic lives in the infrastructure repo's reusable workflow.

### 5. `@nextnode-solutions/standards` — Mandatory (oxlint + oxfmt)

See `/standards` skill for full details. Summary of required setup:

```bash
# Core (MANDATORY — no exceptions)
pnpm add -D @nextnode-solutions/standards oxlint oxfmt

# Commit quality (MANDATORY for all projects)
pnpm add -D @commitlint/cli @commitlint/config-conventional husky lint-staged better-sort-package-json

# Testing (add if project has tests)
pnpm add -D vitest

# Tailwind (add if project uses Tailwind)
pnpm add -D tailwindcss
```

**Required config files** (all must extend from standards):

| File | Content |
|------|---------|
| `oxlint.json` | `{ "extends": ["@nextnode-solutions/standards/oxlint"] }` |
| `oxfmt.json` | `{ "extends": ["@nextnode-solutions/standards/oxfmt"] }` |
| `tsconfig.json` | `{ "extends": "@nextnode-solutions/standards/typescript/<variant>" }` — use `nextjs`, `astro`, or `library` |
| `commitlint.config.js` | `export { default } from '@nextnode-solutions/standards/commitlint'` |
| `lint-staged.config.js` | `export { default } from '@nextnode-solutions/standards/lint-staged'` |
| `vitest.config.ts` | mergeConfig from `@nextnode-solutions/standards/vitest/frontend` or `backend` |
| `tailwind.config.ts` | presets from `@nextnode-solutions/standards/tailwind` (if using Tailwind) |

### 6. Husky Git Hooks

```bash
pnpm exec husky init
```

**`.husky/pre-commit`:**
```sh
pnpm exec lint-staged
```

**`.husky/commit-msg`:**
```sh
pnpm exec commitlint --edit $1
```

### 7. `package.json` Scripts — Required

```json
{
  "scripts": {
    "build": "<framework-build>",
    "dev": "<framework-dev>",
    "lint": "oxlint",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "prepare": "husky",
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit"
  }
}
```

> Replace `<framework-build>` and `<framework-dev>` with framework-specific commands (e.g. `astro build`, `next build`).

### 8. NextNode Packages — Install As Needed

| Package | When to add | Install |
|---------|-------------|---------|
| `@nextnode-solutions/standards` | **ALWAYS** — every project | `pnpm add -D @nextnode-solutions/standards oxlint oxfmt` |
| `@nextnode-solutions/logger` | When the app needs structured logging | `pnpm add @nextnode-solutions/logger` |
| `@nextnode-solutions/email-manager` | When the app sends transactional emails | `pnpm add @nextnode-solutions/email-manager` |

> See `/logger` and `/email-manager` skills (auto-loaded when detected in `package.json`) for usage patterns.

### 9. Compliance Verification Checklist

When updating an app, verify **ALL** of these:

- [ ] `nextnode.toml` exists at repo root with at minimum `[project]` (name, type, domain) — other sections only if overriding defaults
- [ ] `docker-compose.yml` exists with standard structure
- [ ] `Dockerfile` exists with multi-stage build, non-root user, healthcheck
- [ ] `.github/workflows/ci.yml` uses the reusable pipeline (no custom CI logic)
- [ ] `@nextnode-solutions/standards` in `devDependencies` with `oxlint` and `oxfmt`
- [ ] `oxlint.json` extends from standards
- [ ] `oxfmt.json` extends from standards
- [ ] `tsconfig.json` extends from standards (correct variant)
- [ ] `commitlint.config.js` re-exports from standards
- [ ] `lint-staged.config.js` re-exports from standards
- [ ] Husky initialized with `pre-commit` (lint-staged) and `commit-msg` (commitlint) hooks
- [ ] All required `package.json` scripts present (`lint`, `format`, `format:check`, `prepare`, `build`, `test`)
- [ ] pnpm used exclusively (no `package-lock.json` or `yarn.lock`)
- [ ] No barrel exports (`index.ts`) — direct imports only
- [ ] Conventional Commits enforced via commitlint

## Quick Reference: Adding a New Package

1. Create repo in `NextnodeSolutions` org
2. Add `nextnode.toml` with `type = "package"`, `[package]` section
3. Add `.github/workflows/ci.yml` (reusable workflow caller — same template as apps)
4. Set up `@nextnode-solutions/standards` (full compliance kit minus Docker)
5. Use Conventional Commits — semantic-release handles versioning + publishing
6. Add `canary` label to PRs for pre-release testing

## Cost Structure

| Component | Monthly |
|-----------|---------|
| Prod VPS (cpx22) | ~8EUR |
| Dev VPS (cx22) | ~4EUR |
| Monitoring VPS (cpx21) | ~6EUR |
| Hetzner Volumes (20GB) | ~1.60EUR |
| GitHub Actions | Free (public repos) |
| **Total** | **~20EUR** |
