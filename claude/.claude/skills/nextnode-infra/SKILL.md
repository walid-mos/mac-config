---
name: nextnode-infra
description: >-
  NextNode core monorepo overview. Entry point for understanding the platform's
  shared packages (@nextnode-solutions/standards, logger, infrastructure) and how
  to use them in any NextNode project. Dispatches to sub-skills per package.
user-invocable: true
---

# NextNode Core Monorepo

The `@nextnode/core` monorepo is the foundation of all NextNode projects. It contains three packages that every NextNode project depends on. This skill gives an overview and dispatches to the right sub-skill.

## Arguments

- No argument: overview of the monorepo and all packages
- `standards`: redirect to `/nextnode-standards`
- `logger`: redirect to `/nextnode-logger`
- `deploy` or `infra`: redirect to `/nextnode-deploy`
- `setup`: full setup guide for a new NextNode project
- `update`: how to update core packages in a project

## Instructions

### If the user provides a sub-skill argument

Redirect immediately:
- `standards` -> invoke `/nextnode-standards`
- `logger` -> invoke `/nextnode-logger`
- `deploy` or `infra` -> invoke `/nextnode-deploy`

### If no argument or `setup` or `update`

Read the project's `package.json` to understand what core packages it already uses, then provide guidance.

---

## The Monorepo: `@nextnode/core`

**Repo**: `NextNodeSolutions/core`
**Package manager**: pnpm (workspaces)
**Build orchestration**: Turborepo
**Node**: >=24.0.0
**Module system**: ESM only

### Packages

| Package | npm name | Purpose | Has runtime code? |
|---------|----------|---------|-------------------|
| **standards** | `@nextnode-solutions/standards` | Centralized linting, formatting, TypeScript, Vitest, commitlint configs | No (config-only) |
| **logger** | `@nextnode-solutions/logger` | Zero-dependency structured logging with scope, transports, environment detection | Yes |
| **infrastructure** | `@nextnode-solutions/infrastructure` | CI/CD CLI — quality gates, deployment to VPS/Cloudflare/serverless | Yes (CLI binary) |

### Dependency graph

```
@nextnode-solutions/standards (config, no runtime)
  ^-- devDependency of every package and every NextNode project

@nextnode-solutions/logger (zero-dep library)
  ^-- dependency of infrastructure
  ^-- dependency of NextNode apps that need logging

@nextnode-solutions/infrastructure (CLI tool)
  ^-- called by GitHub Actions in every NextNode project
  ^-- depends on logger + smol-toml
```

---

## Setting up a new NextNode project

### 1. Install core packages

```bash
# Standards (always — devDependency)
pnpm add -D @nextnode-solutions/standards oxlint oxfmt

# Logger (if your app needs logging)
pnpm add @nextnode-solutions/logger

# Vitest (if you have tests)
pnpm add -D vitest @vitest/coverage-v8

# Commitlint (if you want commit message linting)
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

### 2. Configure tooling

Create config files that extend from standards. See `/nextnode-standards` for the full reference.

**Minimum setup** (every project):

```
oxlint.json          -> extends @nextnode-solutions/standards/oxlint
.oxfmt.json          -> extends @nextnode-solutions/standards/oxfmt
tsconfig.json        -> extends @nextnode-solutions/standards/typescript/{library|nextjs|astro}
```

**Optional** (depending on project type):

```
vitest.config.ts     -> imports from @nextnode-solutions/standards/vitest/{backend|frontend}
commitlint.config.js -> imports from @nextnode-solutions/standards/commitlint
.editorconfig        -> copy from @nextnode-solutions/standards/editorconfig
.npmrc               -> copy from @nextnode-solutions/standards/npmrc
lint-staged.config.js -> imports from @nextnode-solutions/standards/lint-staged
```

### 3. Add scripts to package.json

```json
{
  "scripts": {
    "build": "tsup",
    "lint": "oxlint",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  }
}
```

### 4. Create nextnode.toml (for deployable apps)

```toml
[project]
name = "my-app"
type = "app"

[scripts]
lint = "lint"
test = "test"
build = "build"
```

See `/nextnode-deploy` for full config reference.

---

## Updating core packages

```bash
# Update all NextNode packages
pnpm update @nextnode-solutions/standards @nextnode-solutions/logger

# Check what changed
pnpm outdated @nextnode-solutions/*
```

Standards is a config package — updates may introduce new lint rules or stricter TypeScript settings. Always run `pnpm lint` and `pnpm type-check` after updating.

---

## Sub-skills reference

| Skill | Invoke with | What it covers |
|-------|------------|----------------|
| `/nextnode-standards` | `/nextnode-standards` | oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged configs |
| `/nextnode-logger` | `/nextnode-logger` | Logger API, transports, testing utilities, integration patterns |
| `/nextnode-deploy` | `/nextnode-deploy` | nextnode.toml, CI/CD pipeline, deployment targets, environments |

## Rules

1. **pnpm only** — all NextNode projects use pnpm. Never suggest npm or yarn.
2. **ESM only** — all packages are ESM. Use `import`, not `require`.
3. **Standards first** — every project MUST use `@nextnode-solutions/standards`. It's not optional.
4. **Config-driven** — behavior is derived from `nextnode.toml` + `docker-compose.yml`. Don't hardcode infrastructure details.
5. **Zero tolerance for `any`** — oxlint enforces `no-explicit-any` as error. Use proper types.
