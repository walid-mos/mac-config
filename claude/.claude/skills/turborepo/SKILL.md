---
name: turborepo
description: >-
  Turborepo monorepo conventions - task pipeline (`turbo.json`, `turbo run`),
  workspace filtering, and the canonical Docker deploy pattern via `turbo prune
  --docker`. Load when working in a `turbo.json` repo or writing a Dockerfile
  for a monorepo workspace package.
user-invocable: true
synced-at: 9be7dae
---

# Turborepo

[Turborepo](https://turborepo.dev) is a build-system orchestrator for JavaScript/TypeScript monorepos. It defines a task pipeline in `turbo.json`, runs tasks in topological order, and caches outputs. It is **package-manager-agnostic** (works with pnpm, npm, yarn, bun) but pairs especially well with pnpm workspaces.

This skill covers two domains: the task pipeline (`turbo.json` + `turbo run`) and the deploy pattern (`turbo prune --docker` + Dockerfile). Most of the operational value lives in the deploy pattern.

## Topics

- **`turbo.json` basics** - task definitions, `dependsOn: ["^build"]`, outputs, caching. See below.
- **Docker deploy pattern** - `turbo prune --docker` + multi-stage Dockerfile. See [docker.md](docker.md).
- **`docker/bake-action` + generated bake file** - the `source: .` gotcha for runtime-rendered bake/compose files. See [docker.md](docker.md#dockerbake-action-with-a-runtime-generated-bake-file).
- **Anti-patterns** - what NOT to do (legacy `pnpm deploy`, `inject-workspace-packages`, bypassing turbo with raw pnpm filters in CI). See [docker.md](docker.md#anti-patterns).

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

- **`dependsOn: ["^build"]`** - the `^` prefix means "the same task in every package this package depends on". So `build` first runs `build` in all dependencies of the target package before running it for the target. This is what makes `pnpm exec turbo build --filter=@org/app` topologically correct.
- **`outputs`** - paths to cache. Turborepo hashes inputs (source files, deps, config) and caches `outputs` by hash. A second run with the same hash skips work.
- **No `outputs` ⇒ no caching** for that task. `format`/`format:check` and other inherently-side-effectful tasks should set `"cache": false` instead of relying on missing outputs.

## Filter syntax

`turbo run <task> --filter=<filter>` - works the same as `pnpm --filter`:

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

## `env` passthrough — the #1 cache-correctness bug

Turborepo does NOT see environment variables unless you declare them. A task that reads `NODE_ENV` or `DATABASE_URL` will produce **the same cached output regardless of env changes** unless those vars are listed in `turbo.json`.

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "env": ["NODE_ENV", "DATABASE_URL", "NEXT_PUBLIC_*"]
    }
  },
  "globalEnv": ["CI", "NODE_ENV"]
}
```

- **`env`** (per-task): env vars that affect that task's output. Changes to these vars bust the task's cache.
- **`globalEnv`**: env vars that bust ALL tasks if changed.
- **Wildcard patterns** (`NEXT_PUBLIC_*`) are supported.
- Missing an env var here = silent stale cache in CI. Always audit before adding CI pipelines.

## Remote caching

Turborepo supports shared remote caches so CI hits the same cache as dev (and different CI runs share hits).

```bash
# Vercel Remote Cache (free for personal/hobby, paid for teams)
turbo login            # authenticate once
turbo link             # link repo to Vercel project

# CI: set TURBO_TOKEN + TURBO_TEAM env vars — turbo picks them up automatically
TURBO_TOKEN=<token> TURBO_TEAM=<org-slug> turbo build
```

Self-hosted alternative: [`turborepo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) (open-source, S3-compatible). Set `TURBO_API` + `TURBO_TOKEN` to point at it.

Remote caching is opt-in and transparent — `turbo run` behaves identically with or without it; the only difference is where cache artifacts are stored and shared from.

## Rules

1. **Task pipelines live in `turbo.json`.** Cross-package task ordering goes through `dependsOn: ["^task"]`, not via shell scripts that chain pnpm filters.
2. **Always go through `turbo run`** for tasks defined in `turbo.json`. Raw `pnpm --filter` skips the cache.
3. **Use `turbo prune --docker` for monorepo Dockerfiles.** It is the canonical Turborepo Docker pattern. See [docker.md](docker.md). Do NOT use `pnpm deploy` + `inject-workspace-packages` in a Turborepo - that combo predates turbo prune and forces hard-linked workspace deps, which breaks live editing of shared packages.
4. **Declare `outputs` for any cacheable task.** Without `outputs`, turbo can't restore from cache. Tasks that don't produce artifacts but are still expensive (e.g., `lint`) should rely on `inputs` hashing alone - outputs `[]` is valid.
5. **`.dockerignore` is mandatory before `turbo prune --docker`.** See [docker.md](docker.md#dockerignore-mandatory) for the required entries. Missing it ships host symlinks into the image.
6. **`docker/bake-action@v6` needs `source: .` for a runtime-generated bake file.** Its default `source` is the Git context, which ignores files a prior CI step writes into the workspace — so a rendered `docker-bake.json` is read as "not there". Set `source: .` to run Bake from the runner workspace. See [docker.md](docker.md#dockerbake-action-with-a-runtime-generated-bake-file).

## Quick reference

| NEVER | ALWAYS |
|---|---|
| `pnpm --filter @org/app build` in CI (bypasses cache) | `turbo run build --filter=@org/app` |
| `pnpm deploy` + `inject-workspace-packages` in a Turborepo | `turbo prune --docker` |
| Ship dev deps in the runtime stage | Install `--prod` or prune deps in a separate runtime stage |
| Omit `outputs` on a cacheable task | Declare `outputs: ["dist/**"]` or `outputs: []` + `cache: false` |
| Omit `env[]` for tasks that read env vars | List every env var that affects the output in `env` or `globalEnv` |
| Copy `.` without a `.dockerignore` | Always add `.dockerignore` with `node_modules`, `.turbo`, `.git`, `dist` |
| Set `format`/`lint:check` `outputs` (they have none) | Use `"cache": false` for purely side-effectful tasks |

## Cross-references

- `/nextnode-deploy` - NextNode `@nextnode-solutions/infrastructure` CI/CD wrapper. Hetzner-specific runtime contract for caller repos lives there.
- `/nextnode-standards` - shared configs that workspace deps typically expose (`@nextnode-solutions/standards/typescript/astro`, etc.).
