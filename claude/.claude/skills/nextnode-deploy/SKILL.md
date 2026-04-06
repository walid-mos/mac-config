---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure). Config
  parsing, CI quality gates, publish pipeline, and prod gate.
user-invocable: true
synced-at: 84143e4
---

# @nextnode-solutions/infrastructure

Config-driven CI/CD CLI for NextNode projects. Reads `nextnode.toml`, runs quality gates, parses publish results, and enforces prod gates.

**Source**: `packages/infrastructure` in `@nextnode/core`
**Binary**: `infra` (3 commands: `plan`, `publish-result`, `prod-gate`)

## Instructions

Always read the actual code before answering — start with `packages/infrastructure/src/` and `packages/infrastructure/CLAUDE.md`.

## CLI commands

| Command | What it does |
|---------|-------------|
| `plan` (default) | Parse `nextnode.toml`, output quality matrix + plan outputs |
| `publish-result` | Parse semantic-release output, write status/version/summary |
| `prod-gate` | Verify dev pipeline passed before production deploy |

## Config: nextnode.toml

```toml
[project]
name = "my-app"        # Required — string
type = "app"           # Required — "app" | "package" | "static"
filter = false         # Optional — turbo --filter value

[scripts]              # Optional — defaults: lint="lint", test="test", build="build"
test = false           # Set to false to disable

[package]              # Optional — only for type="package" with npm publish
access = "public"

[environment]          # Optional — default: development=true
development = true     # false = no prod-gate (direct-to-prod)
```

See [config.md](config.md) for full schema.

## Pipeline architecture

No single `pipeline.yml` — callers choose one of three reusable workflows directly based on `type`:

| Workflow | For | Flow |
|----------|-----|------|
| `publish-package.yml` | `type=package` | plan → quality → publish (semantic-release) |
| `deploy.yml` | `type=app` (Hetzner future) | plan → quality (+ prod-gate if prod) → deploy |
| `deploy-static.yml` | `type=static` (Cloudflare Pages) | plan → quality (+ prod-gate if prod) → deploy |

Both `deploy.yml` and `deploy-static.yml` take an `environment: development \| production` input. The same workflow is called twice by the caller (one file per env). prod-gate runs as a **matrix task inside quality** (not a separate job) when `environment=production` and `config.environment.development=true`.

See [pipeline.md](pipeline.md) for details.

## Kickstarting a new package

Full step-by-step guide to add a new publishable package to the monorepo: `package.json`, `nextnode.toml`, `.releaserc.json`, `tsup.config.ts`, `tsconfig.json`, linting/formatting configs, GitHub workflow, and a pre-push checklist.

See [kickstart-package.md](kickstart-package.md) for the complete guide.

## Usage (caller repos)

```yaml
# type=package (e.g. logger, standards)
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/publish-package.yml@main
    secrets: inherit

# type=static or type=app — caller needs one file per environment
# deploy-dev.yml:
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: development
    secrets: inherit

# deploy-prod.yml:
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: production
    secrets: inherit
```

Caller repos use the convention `.github/workflows/deploy-dev.yml` + `.github/workflows/deploy-prod.yml` — the `deploy-dev.yml` path is hardcoded in `prod-gate.ts` (it looks for that workflow run in the caller repo to verify dev passed).

Monorepo: one workflow per package with `paths:` filter + `filter` in nextnode.toml.

## Rules

1. **Check the code, not assumptions** — only reference features that exist in source
2. **Callers choose their workflow by `type`** — `package` → `publish-package.yml`, `app` → `deploy.yml`, `static` → `deploy-static.yml`
3. **One caller file per environment** — deploy workflows take `environment: development | production` input
4. **prod-gate lives in the quality matrix** — added as a task when `environment=production` AND `config.environment.development=true`
5. **Path-filtered triggers for monorepos** — one workflow per package
