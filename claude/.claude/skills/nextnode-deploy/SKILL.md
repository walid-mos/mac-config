---
name: nextnode-deploy
description: >-
  NextNode infrastructure package (@nextnode-solutions/infrastructure). Config
  parsing and CI quality gates. Use when working on or integrating the infra
  CLI in a NextNode project.
user-invocable: true
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
4. `packages/infrastructure/src/pipeline/quality.ts` — Quality gate runner
5. `packages/infrastructure/CLAUDE.md` — Architecture and design decisions

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

**Validation**: returns typed `NextNodeConfig` or a list of errors (discriminated union `ok: true | false`).

---

## Quality gate (CI)

Invoked via:

```bash
PIPELINE_CONFIG_FILE=nextnode.toml PIPELINE_ACTION=ci tsx src/index.ts
```

Flow:
1. Read `nextnode.toml`
2. Build quality matrix from `[scripts]` — runs `lint` and `test` (not `build`)
3. Execute each via `pnpm {script}` with `execSync`
4. Report pass/fail with timing per task
5. Exit 1 if any check fails

### CLI env vars

- `PIPELINE_CONFIG_FILE` — path to `nextnode.toml` (required)
- `PIPELINE_ACTION` — currently only `"ci"` (required)

### Dependencies

- `@nextnode-solutions/logger` — structured logging
- `smol-toml` — TOML parsing

---

## Using in a NextNode project

### 1. Create nextnode.toml

```toml
[project]
name = "my-app"
type = "app"
```

### 2. GitHub Actions

```yaml
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

Runs lint + test on every push to main and on PRs.

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

### Adding a pipeline action

1. Add the action name to `VALID_ACTIONS` in `src/index.ts`
2. Create the action logic in `src/pipeline/`
3. Dispatch to it from `main()`

### Extending the config schema

1. Add types to `src/config/schema.ts`
2. Update `parseConfig()` validation
3. Add fixtures in `src/config/fixtures/`
4. Update tests

## Rules

1. **Check the code, not assumptions** — only reference features that exist in source
2. **Config grows with implementation** — add schema sections only when building their feature
3. **pnpm only** — pnpm workspace
4. **ESM only** — `import`, not `require`
