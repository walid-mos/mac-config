---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure). Config
  parsing, CI quality gates, publish pipeline, and prod gate.
user-invocable: true
synced-at: 1027421
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
type = "app"           # Required — "app" | "package"
filter = false         # Optional — turbo --filter value

[scripts]              # Optional — defaults: lint="lint", test="test", build="build"
test = false           # Set to false to disable

[package]              # Optional — only for type="package" with npm publish
access = "public"

[environment]          # Optional — default: development=true
development = true     # false = skip prod-gate, run inline quality in deploy-prod
```

See [config.md](config.md) for full schema.

## Pipeline architecture

No single `pipeline.yml` — callers choose one of three reusable workflows directly:

| Workflow | For | Flow |
|----------|-----|------|
| `publish-package.yml` | `type=package` | plan → quality → publish (semantic-release) |
| `deploy-dev.yml` | `type=app` (dev) | plan → quality → deploy |
| `deploy-prod.yml` | `type=app` (prod) | plan → prod-gate OR quality → deploy |

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

# type=app (dev)
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-dev.yml@main
    secrets: inherit
```

Monorepo: one workflow per package with `paths:` filter + `filter` in nextnode.toml.

## Rules

1. **Check the code, not assumptions** — only reference features that exist in source
2. **Callers choose their workflow** — no magic routing, caller picks publish/deploy-dev/deploy-prod
3. **Path-filtered triggers for monorepos** — one workflow per package
