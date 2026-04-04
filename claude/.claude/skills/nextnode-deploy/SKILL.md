---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure). Config
  parsing and CI quality gates. Use when working on or integrating the infra
  CLI in a NextNode project.
user-invocable: true
synced-at: b582aa0
---

# @nextnode-solutions/infrastructure

Config-driven CI/CD CLI for NextNode projects. Reads `nextnode.toml` and runs quality gates.

**Source**: `packages/infrastructure` in `@nextnode/core`
**npm**: `@nextnode-solutions/infrastructure`
**Binary**: `infra`

## Arguments

- No argument: overview + how to integrate
- `config`: nextnode.toml schema
- `pipeline` or `ci`: quality gate pipeline
- `contribute`: how to extend this package

## Instructions

### Phase 1: Read the source

Always read the actual code before answering:

1. `packages/infrastructure/src/index.ts` — CLI entry point
2. `packages/infrastructure/src/config/schema.ts` — Config types and validation
3. `packages/infrastructure/src/config/load.ts` — TOML loading
4. `packages/infrastructure/src/pipeline/quality.ts` — Quality matrix builder
5. `packages/infrastructure/src/pipeline/plan.ts` — GITHUB_OUTPUT writer
6. `.github/workflows/pipeline.yml` — Reusable workflow
7. `.github/actions/setup/action.yml` — Composite setup action
8. `packages/infrastructure/CLAUDE.md` — Architecture and design decisions

---

## Config: nextnode.toml

```toml
[project]
name = "my-app"        # Required — project identifier
type = "app"           # Required — "app" or "package"
```

That's the minimum. Scripts default to `lint = "lint"`, `test = "test"`, `build = "build"`. Only add `[scripts]` if you need to override or disable something:

```toml
# Only when you need to change defaults
[scripts]
test = false           # Disable tests in CI
build = "build:prod"   # Custom script name
```

### Monorepo filter

For packages inside a turborepo monorepo, add `filter` to scope quality commands to a single package via `turbo --filter`:

```toml
[project]
name = "logger"
type = "package"
filter = "@nextnode-solutions/logger"
```

When `filter` is set, quality commands become `pnpm turbo run {task} --filter={filter}` instead of `pnpm {task}`. When absent or `false`, commands run unscoped (default behavior).

**Validation**: returns typed `NextNodeConfig` or a list of errors (discriminated union `ok: true | false`).

See [config.md](config.md) for full schema reference.

---

## Pipeline architecture

### Workflow: `pipeline.yml`

Reusable workflow (`workflow_call`) — every NextNode project calls it, never defines its own CI jobs.

**Inputs**:
- `config_file` (string, default `"nextnode.toml"`) — path to config in caller repo
- `environment` (string, default `"development"`) — target: `development` or `production`

**Jobs**:
1. **Plan** — reads `nextnode.toml`, outputs `quality_matrix`, `project_name`, `project_type`
2. **Quality** — matrix job running each quality task (lint, test) in parallel
3. **Post-quality routes** (exactly one fires based on `project_type` + `environment`):
   - `publish` — when `type = "package"`
   - `deploy-dev` — when `type = "app"` + `environment = "development"`
   - `deploy-prod` — when `type = "app"` + `environment = "production"`

### Composite action: `setup/action.yml`

Shared setup for all jobs. Two modes via inputs:
- `infra: "true"` — sparse-checkout core infrastructure + install its deps (for plan/deploy jobs)
- `deps: "true"` (default) — install caller project deps (for quality/publish jobs)

### Quality matrix generation

`buildQualityMatrix(scripts, project)` in `quality.ts`:
- Produces tasks for enabled `lint` and `test` scripts (never `build`)
- When `project.filter` is a string: `pnpm turbo run {task} --filter={filter}`
- When `project.filter` is `false`: `pnpm {task}`
- Empty matrix triggers skip sentinel in `plan.ts`

See [pipeline.md](pipeline.md) for flow details.

---

## Using in a NextNode project

### Single-package repo

```toml
# nextnode.toml
[project]
name = "my-app"
type = "app"
```

```yaml
# .github/workflows/pipeline.yml
name: Pipeline
on:
  push:
    branches: [main]
  pull_request:

jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/pipeline.yml@main
    secrets: inherit
```

### Monorepo (per-package workflows)

Each package gets its own workflow with path filters, its own `nextnode.toml`, and calls the same pipeline:

```yaml
# .github/workflows/logger.yml
name: Logger
on:
  push:
    branches: [main]
    paths: ['packages/logger/**']
  pull_request:
    paths: ['packages/logger/**']

jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/pipeline.yml@main
    with:
      config_file: packages/logger/nextnode.toml
    secrets: inherit
```

```toml
# packages/logger/nextnode.toml
[project]
name = "logger"
type = "package"
filter = "@nextnode-solutions/logger"
```

GitHub only triggers the workflow when files in that package change. The `filter` field scopes turbo to that package.

---

## Contributing

### Development

```bash
cd packages/infrastructure
pnpm dev          # tsx src/index.ts
pnpm test         # vitest run
pnpm test:watch   # vitest watch
pnpm lint         # oxlint
pnpm format       # oxfmt
pnpm typecheck    # tsc --noEmit
```

### Extending the config schema

1. Add types to `src/config/schema.ts`
2. Update `parseConfig()` validation
3. Add fixtures in `src/config/fixtures/`
4. Update tests

### Adding a pipeline action

1. Create the action logic in `src/pipeline/`
2. Dispatch to it from `main()` in `src/index.ts`

## Rules

1. **Check the code, not assumptions** — only reference features that exist in source
2. **Config grows with implementation** — add schema sections only when building their feature
3. **pnpm only** — pnpm workspace
4. **ESM only** — `import`, not `require`
5. **One pipeline workflow** — every project calls `pipeline.yml`, never defines its own CI jobs
6. **Path-filtered triggers for monorepos** — one workflow per package with `paths:` filter, not one workflow for everything
