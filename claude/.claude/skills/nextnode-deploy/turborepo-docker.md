# Turborepo + Docker

The canonical pattern for shipping a single workspace package as a Docker image from a Turborepo monorepo. Provider-agnostic - the resulting image runs on any Docker host (Hetzner VPS, Render, AWS ECS, Scaleway, Fly.io, GHCR, etc.). Source: [Turborepo official Docker guide](https://turborepo.dev/docs/guides/tools/docker).

## The two-step idea

1. **Prune** the monorepo down to the target package's dependency subgraph: `turbo prune <target> --docker`.
2. **Build** that pruned subset inside Docker, exploiting layer caching by copying manifests *before* source.

The output of `turbo prune --docker` is structured to make Docker layer caching trivial:

```
out/
  json/             - only package.json files (one per pruned workspace)
  full/             - full source of pruned workspaces
  pnpm-lock.yaml    - lockfile pruned to the subgraph (frozen-compatible)
  pnpm-workspace.yaml (if present)
```

The split is what unlocks the killer property: **install layer is cache-stable until a `package.json` changes**. Source edits don't bust install.

## Reference Dockerfile (pnpm + Node 24)

```dockerfile
FROM node:24-alpine AS base
WORKDIR /repo
RUN corepack enable pnpm

# Stage 1 - Prune the monorepo to <target>'s dependency subgraph.
# `turbo prune --docker` writes /repo/out/{json,full,pnpm-lock.yaml,...}.
FROM base AS prepare
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @org/app --docker

# Stage 2 - Install only the pruned subgraph's deps. This layer is
# cache-stable as long as no package.json changes (out/json contains
# only manifests). Editing application source does NOT bust this.
FROM base AS deps
COPY --from=prepare /repo/out/json/ ./
COPY --from=prepare /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY .npmrc ./
RUN pnpm install --frozen-lockfile

# Stage 3 - Build via turbo (respects ^build topology + cache).
FROM deps AS build
COPY --from=prepare /repo/out/full/ ./
RUN pnpm exec turbo build --filter=@org/app

# Stage 4 - Runtime: only the built artefact + prod deps.
# Install production deps from scratch (do NOT copy node_modules from build
# stage — that includes all dev deps and silently bloats the image).
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable pnpm
COPY --from=prepare /repo/out/json/ ./
COPY --from=prepare /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /repo/packages/app/dist ./dist
COPY --from=build /repo/packages/app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server/entry.mjs"]
```

### Why each stage exists

| Stage | Why |
|---|---|
| `base` | Single source of truth for the Node version + pnpm enablement. Reused everywhere. |
| `prepare` | Where `turbo prune --docker` runs. Needs the full repo + a global `turbo`. Discarded after - turbo is not shipped at runtime. |
| `deps` | Cacheable install. Copies *only* manifests + lockfile - layer is invalidated only when a `package.json` actually changes. |
| `build` | Adds source on top of `deps`, runs the actual build via `turbo`. Source edits invalidate this layer but not `deps`. |
| `runtime` | Fresh `node:24-alpine` base. Runs `pnpm install --prod` on the pruned manifests, then copies only the built artefact. Prod deps only — no turbo, no dev deps, no source. |

## `.dockerignore` (mandatory)

```
node_modules
**/node_modules
.turbo
**/.turbo
dist
**/dist
.git
**/*.log
```

Without this, the `COPY . .` in `prepare` ships:
- Host `node_modules` symlinks pointing outside the container (build fails or - worse - silently uses stale deps)
- Host `.turbo` cache (irrelevant inside the image)
- Host `dist/` from previous local builds (overwritten anyway, just wasted bytes + cache busting)

## Anti-patterns

### `pnpm deploy` + `inject-workspace-packages=true`

Pre-Turborepo workaround for "ship a single workspace package as a self-contained bundle". Two costs:

1. **Forces `inject-workspace-packages=true`** in `.npmrc` or `pnpm-workspace.yaml`. With injection, workspace deps are hard-linked instead of symlinked, so editing a shared workspace package (e.g. `@org/standards/tsconfig.astro.json`) does NOT propagate without `pnpm install`. Real DX tax.
2. **Reinvents what `turbo prune` already does** - produce a self-contained subgraph for deploy.

If you find yourself reaching for `pnpm deploy --legacy`, you're doubling down on the anti-pattern. The right move is to migrate the Dockerfile to `turbo prune --docker`.

### `pnpm install` then `COPY packages/ .`

The classic "naive monorepo Dockerfile":

```dockerfile
# ANTI-PATTERN - every source edit busts the install layer
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @org/app...
RUN pnpm --filter @org/app... build
```

Three problems:

- `COPY packages ./packages` includes all source, so any source edit invalidates install.
- Filter `@org/app...` ships `package.json`s of unrelated workspaces *if they share a parent path*, since pnpm filter graph doesn't prune the lockfile.
- Bypasses turbo cache.

## `docker/bake-action` with a runtime-generated bake file

When CI builds images via [`docker/bake-action`](https://github.com/docker/bake-action) and the bake file (or compose file) is **generated at build time** — rendered from a config source of truth by a prior step rather than committed — you MUST set `source: .` on the bake-action step:

```yaml
- name: Build and push
  uses: docker/bake-action@v6
  with:
    source: .                                       # run Bake from the runner workspace
    files: ${{ steps.render.outputs.bake_file }}    # a file a previous step wrote at runtime
    push: true
```

**Why.** `docker/bake-action@v6` defaults `source:` to the **Git context** (the commit being built), not the runner's working directory. A `docker-bake.json` a previous step writes into `$GITHUB_WORKSPACE` is therefore invisible to Bake — it reads the tree as committed, where the file does not exist. Symptom: `failed to read` / `no such file` for a file that is demonstrably sitting in the workspace. Setting `source: .` runs Bake from the workspace, so `files:` resolves by relative path/basename and each target's `context: "."` resolves to the repo root.

This is orthogonal to the `turbo prune` Dockerfile pattern above — it applies whenever the bake definition is produced at runtime (rendered tags, config-driven targets, a bake file emitted from a single source of truth) instead of being checked in.

## Smoke test

Always test the image locally before pushing a commit that triggers CI deploy:

```bash
docker build -f packages/app/Dockerfile -t app:smoke .
docker run --rm -p 3000:3000 -e PORT=3000 app:smoke
curl -fsS http://localhost:3000/   # expect 200
```

What this catches that `pnpm build` does NOT:

- Missing files in the image (e.g., `dist/` not in package's `"files"` field - `pnpm install` may treat `dist/` as gitignored and exclude it).
- Wrong `WORKDIR` / `CMD` paths.
- Runtime deps missing from `node_modules` because `pnpm install` was run with `--prod=false` then deps got pruned.
- `HOST` binding issues (Astro + most Node SSR servers default to `localhost`/`127.0.0.1` which Docker port-mapping cannot reach - set `host: true` in framework config or `HOST=0.0.0.0` env var).

## Provider notes

The same image runs on any Docker host. Provider-specific concerns (port mapping, env injection, reverse proxy, secret management) live outside the image and outside this skill - see the deploy-pipeline skill for the relevant provider.
