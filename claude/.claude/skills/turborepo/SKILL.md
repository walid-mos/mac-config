---
name: turborepo
description: >-
  Turborepo monorepo conventions — task pipeline (`turbo.json`), workspace
  filtering, and the canonical Docker deploy pattern via `turbo prune
  --docker`. Provider-agnostic: works for any Docker target (Hetzner, Render,
  AWS ECS, Scaleway, Fly, GHCR, etc.). Load when working in a `turbo.json`
  repo or when writing a Dockerfile for a monorepo workspace package.
user-invocable: true
synced-at: 9be7dae
---

# Turborepo

[Turborepo](https://turborepo.dev) is a build-system orchestrator for JavaScript/TypeScript monorepos. It defines a task pipeline in `turbo.json`, runs tasks in topological order, and caches outputs. It is **package-manager-agnostic** (works with pnpm, npm, yarn, bun) but pairs especially well with pnpm workspaces.

This skill covers two domains: the task pipeline (`turbo.json` + `turbo run`) and the deploy pattern (`turbo prune --docker` + Dockerfile). Most of the operational value lives in the deploy pattern.

## Topics

- **`turbo.json` basics** — task definitions, `dependsOn: ["^build"]`, outputs, caching. See below.
- **Docker deploy pattern** — `turbo prune --docker` + multi-stage Dockerfile. See [docker.md](docker.md).
- **Anti-patterns** — what NOT to do (legacy `pnpm deploy`, `inject-workspace-packages`, bypassing turbo with raw pnpm filters in CI). See [docker.md](docker.md#anti-patterns).

## `turbo.json` essentials

Minimal config:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

Key concepts:

- **`dependsOn: ["^build"]`** — the `^` prefix means "the same task in upstream workspace deps". So `build` first runs `build` in every workspace dep before running it for the target. This is what makes `pnpm exec turbo build --filter=@org/app` topologically correct.
- **`outputs`** — paths to cache. Turborepo hashes inputs (source files, deps, config) and caches `outputs` by hash. A second run with the same hash skips work.
- **No `outputs` ⇒ no caching** for that task. `format`/`format:check` and other inherently-side-effectful tasks should set `"cache": false` instead of relying on missing outputs.

## Filter syntax

`turbo run <task> --filter=<filter>` — works the same as `pnpm --filter`:

| Filter | Selects |
|---|---|
| `@org/app` | just the named workspace |
| `@org/app...` | named workspace **and** its workspace deps (downstream) |
| `...@org/app` | named workspace **and** anything that depends on it (upstream) |
| `[main]` | workspaces changed since `main` |
| `--filter='./packages/*'` | by glob |

In CI: combine with `[HEAD^1]` to run tasks only on changed packages.

## When to use turbo vs raw pnpm

**Always use turbo in a Turborepo.** `pnpm --filter @org/app... build` builds the package and its deps but **bypasses turbo's cache**. In CI this means rebuilding everything every run. The right call is `pnpm exec turbo build --filter=@org/app` (or just `turbo build --filter=@org/app` if turbo is on PATH).

The only case for raw `pnpm --filter` is one-off scripts that aren't part of the task pipeline (e.g., a custom dev orchestrator).

## Rules

1. **Task pipelines live in `turbo.json`.** Cross-package task ordering goes through `dependsOn: ["^task"]`, not via shell scripts that chain pnpm filters.
2. **Always go through `turbo run`** for tasks defined in `turbo.json`. Raw `pnpm --filter` skips the cache.
3. **Use `turbo prune --docker` for monorepo Dockerfiles.** It is the canonical Turborepo Docker pattern. See [docker.md](docker.md). Do NOT use `pnpm deploy` + `inject-workspace-packages` in a Turborepo — that combo predates turbo prune and forces hard-linked workspace deps, which breaks live editing of shared packages.
4. **Declare `outputs` for any cacheable task.** Without `outputs`, turbo can't restore from cache. Tasks that don't produce artifacts but are still expensive (e.g., `lint`) should rely on `inputs` hashing alone — outputs `[]` is valid.
5. **Add `node_modules`, `.turbo`, `dist`, `.git` to `.dockerignore`** before running `turbo prune --docker`. Otherwise the Docker build context drags symlinks pointing outside the container.

## Cross-references

- `/nextnode-deploy` — NextNode `@nextnode-solutions/infrastructure` CI/CD wrapper. Hetzner-specific runtime contract for caller repos lives there.
- `/nextnode-standards` — shared configs that workspace deps typically expose (`@nextnode-solutions/standards/typescript/astro`, etc.).
