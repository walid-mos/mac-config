# Hetzner Caller Convention

What a project repo (the caller) must provide to deploy via `deploy.yml` to a Hetzner VPS. Covers only the Hetzner-caller specifics - the `nextnode.toml` schema lives in [config.md](config.md), the pipeline shape in [pipeline.md](pipeline.md).

## Files in the caller repo

Two files, both at the project root:

1. **`Dockerfile`** - container build definition
2. **`nextnode.toml`** - with `type = "app"`, `[deploy]`, `[deploy.hetzner]` and at least one `[deploy.services.<name>]` table (schema in [config.md](config.md)). This is the single source of truth for build shape — the caller ships **no** `docker-compose.yml`.

Plus two workflow files under `.github/workflows/`:

- **`deploy-dev.yml`** - triggers on push to `main`
- **`deploy-prod.yml`** - `workflow_dispatch` only (manual)

## Build shape (from `nextnode.toml`)

`nextnode.toml` is the single source of truth for build shape — there is **no caller `docker-compose.yml`**. Each `[deploy.services.<name>]` with `source = "build"` becomes one target in the `docker-bake.json` that `compute-image-ref` renders in CI:

```toml
[deploy.services.web]
source = "build"            # default; omit
# context    = "."                       # default: repo root
# dockerfile = "apps/landing/Dockerfile" # default: <packageDir>/Dockerfile
# target     = "web"                      # default: the Dockerfile's final stage
```

The instance name (table key, KEBAB) flows end-to-end — see rule 1 below. N services per project are accepted.

`context` / `dockerfile` / `target` are optional per-service overrides — the defaults reconstruct the monorepo build (context = repo root, dockerfile = `<packageDir>/Dockerfile`, the Dockerfile's final stage). See [config.md](config.md) for the full field reference.

## Infra-owned runtime concerns

The VPS runtime compose is **rendered by the infra** (`renderComposeFile`), not written by the caller. These concerns are owned end-to-end by the infra and configured through `nextnode.toml` — never hand-authored:

| Concern | Owned by |
|---------|----------|
| `image:` | Injected per service by the rendered `docker-bake.json` (`<target>.tags = <ref>`). Refs are resolved by `compute-image-ref` (`build`) or read from `[deploy.services.<name>].ref` (`upstream`). |
| `ports:` | Host port per `url` service is allocated by `allocateHostPort` and wired to Caddy on the VPS. |
| `env_file:` / `environment:` | The VPS-rendered compose points each service at its own `.env.<name>` file, generated from injected vars + per-service `[deploy.services.<name>].secrets`. |
| `restart:` | Prod compose on the VPS always uses `restart: unless-stopped`. |
| `healthcheck:` | The infra attaches a `/healthz` probe to every `build` service (wget against the declared `port`). `upstream` services keep their image's own contract — no probe forced. |
| `volumes:` | Declared in `nextnode.toml` via `[deploy.volumes]` so the infra owns naming, lifecycle, and teardown semantics — see Persistent volumes below. |

## Runtime contract (the container)

The infra injects these env vars into each service's per-service env file on the VPS (`.env.<name>`, picked up by compose `env_file`):

- `PORT=<service.port>` — the value comes from `[deploy.services.<name>].port` (default `3000`). The same value drives the compose port mapping (`127.0.0.1:<host>:<service.port>`) AND the `/healthz` probe, so an app on a non-default port stays consistent end-to-end.
- `SITE_URL=https://<domain or dev.domain>` (from `resolveDeployDomain`)
- **One `<SIBLING_NAME_UPPER_SNAKE>_URL=https://<resolved-hostname>` per routed sibling**, including the service's own URL — symmetric injection so no service needs to know who depends on whom. Example: services `front` + `admin-api` (both with `url`) get `FRONT_URL` AND `ADMIN_API_URL` in BOTH `.env.front` and `.env.admin-api`. Internal services (no `url`) contribute nothing here and reach siblings via the compose network as `<service-name>:<port>`.
- One var per secret declared in `[deploy.services.<name>].secrets`

**The app MUST respect the `$PORT` env var (12-factor).** Node/Astro/Express/Fastify/Next all do this by default — `process.env.PORT` resolves to the declared port at runtime and the app binds correctly. Caddy reverse-proxies traffic onto the allocated host port for `url` services. No value is hardcoded in caller code.

### `/healthz` contract (build services)

Every `build` service answers a liveness probe at `GET /healthz` on its declared `port`. The compose healthcheck runs `wget -q -O- http://localhost:<port>/healthz` every 10 s, times out at 3 s, and retries up to 6 times. `wget` and the `/healthz` route are guaranteed by the alpine / distroless-busybox bases NextNode build images ship on. `upstream` services are NOT probed (their base may answer neither). Once `depends_on` health gating is enforced, dependents will wait on this probe before starting.

## Persistent volumes

Containers can mount Docker named volumes for state that must survive a redeploy
(SQLite db, cache directory, generated assets, etc.). Declare them in
`nextnode.toml` - the infra renders them into the VPS runtime compose.

```toml
[deploy.volumes]
data  = "/var/lib/app"
cache = "/var/cache/app"
```

The infra renders this into the prod compose on the VPS (volumes attach to the PRIMARY service — the first declared `[deploy.services.<name>]`):

```yaml
services:
    web:
        # ...image, env_file, ports injected by infra...
        volumes:
            - data:/var/lib/app
            - cache:/var/cache/app
volumes:
    data: {}
    cache: {}
```

Each alias becomes a Docker named volume managed by the Docker daemon under
`/var/lib/docker/volumes/<silo>_<alias>/`. Aliases are lowercase alphanumeric
and the mount path must be absolute.

### Lifecycle

- **Redeploys preserve volumes.** A new image release re-uses the existing
  volumes - that's the whole point.
- **Teardown preserves volumes by default.** `infra teardown` keeps the named
  volumes intact unless the caller passes the explicit opt-in to wipe them.
- **Volumes are tied to one VPS.** They are NOT replicated and NOT a backup.
  Losing the VPS loses the volume.

### Volumes are the hot cache, not the durability layer

In the NextNode topology, **R2 is the durable source of truth** for any data the
app must not lose. Local VPS SSD (where Docker named volumes live) is an
ephemeral hot cache: fast, included with the VPS, but rebuildable from R2 on
demand. See `docs/infra-topology.md` for the full split - the relevant rule:

- **Source of truth → R2** (Postgres WAL, dumps, uploaded files, etc.)
- **Hot working set → Docker named volume on the VPS local SSD**
- Hetzner Block Volumes are **not** used by default

Wiring the R2-backed durability (WAL-G, restic, custom dump-and-push) is a
separate concern owned by the app - out of scope of `[deploy.volumes]`. This
section only declares the local cache mount; the app is responsible for keeping
R2 in sync if the data must survive a VPS loss.

## Caller workflow files

```yaml
# .github/workflows/deploy-dev.yml
name: Deploy dev
on:
    push:
        branches: [main]
jobs:
    pipeline:
        uses: NextNodeSolutions/core/.github/workflows/deploy.yml@main
        with:
            environment: development
        secrets: inherit
```

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy prod
on:
    workflow_dispatch:
jobs:
    pipeline:
        uses: NextNodeSolutions/core/.github/workflows/deploy.yml@main
        with:
            environment: production
        secrets: inherit
```

`secrets: inherit` is MANDATORY. All infra secrets (`HETZNER_API_TOKEN`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_PRIVATE_KEY_B64`, `CLOUDFLARE_*`, `R2_*`, `NEXTNODE_APP_ID`, `NEXTNODE_APP_PRIVATE_KEY`) live at the `NextNodeSolutions` GitHub org level - no per-repo setup needed. App-specific secrets are declared **per service** in `[deploy.services.<name>].secrets` (hetzner-vps) — the deploy-wide pool is their union — and must exist as GitHub secrets the caller repo can see, set as per-environment **env-secrets** on the repo (per SKILL.md rule 10: project secrets are env-secrets, never org-secrets). cloudflare-pages still declares them in `[deploy].secrets`.

## Dockerfile

See **[turborepo-docker.md](turborepo-docker.md)** for the canonical multi-stage Dockerfile pattern (Rule 6 - provider-agnostic). Keep the port convention (`EXPOSE 3000`).

## Monorepo callers

When the caller is a workspace package inside a Turborepo monorepo (e.g. `packages/monitoring` in `@nextnode/core`), the Dockerfile pattern is **provider-agnostic** - same image runs on Hetzner, Render, ECS, Scaleway, Fly. That pattern lives in its own skill:

→ See **[turborepo-docker.md](turborepo-docker.md)** for the canonical `turbo prune --docker` Dockerfile, layer-caching breakdown, and anti-patterns (legacy `pnpm deploy` + `inject-workspace-packages`).

What stays Hetzner-specific (this file) is the **runtime contract**: the declared `[deploy.services.<name>]` name, the `port` (default 3000), infra-owned runtime concerns, per-service env injection, Caddy proxy, `/healthz` probe for build services. The Dockerfile must respect those, but its build strategy is a generic monorepo concern.

## Image source - build vs upstream

The `source` field on each `[deploy.services.<name>]` table selects whether the deploy pipeline **builds** the project's `Dockerfile` for that service or **pulls a prebuilt upstream** image. **All services in a project MUST share the same `source`** — mixing build and upstream is rejected at parse time. The legacy `[deploy.image]` table was removed (`refactor(infrastructure): drop legacy deploy.image schema and image_ref output`); the validator surfaces `deploy.image is an unknown field — migrate to [deploy.services.<name>]` if it's still present.

Upstream registry auth must be homogeneous across services — see [multi-service.md](multi-service.md) Registry token.

```toml
# Default - build from local Dockerfile
[deploy.services.web]
# source = "build" is the default; omit the field

# Or: consume a prebuilt upstream image
[deploy.services.web]
source = "upstream"
ref = "ghcr.io/some-org/some-image:v1.2.3"
registry_auth_secret = "GHCR_READ_TOKEN"   # optional - omit for public images
```

| `source` | What happens | When to use |
|----------|-------------|------------|
| `"build"` (default) | The service becomes a target in the rendered `docker-bake.json`. The `build-image` job runs a single multi-target `docker/bake-action`, pushes to GHCR (`ghcr.io/<owner>/<repo>-<service>:sha-<7>`), deploy pulls it. Logs in to GHCR with `GHCR_TOKEN` — no extra config needed. | Your project, your Dockerfile. |
| `"upstream"` | The service is not built — when every service is `upstream`, `build-image` is skipped entirely and no bake file is rendered. Plan emits the parsed `ref` in `upstream_image_refs` as `{<service>: {registry, repository, tag}}`, fed into the deploy job as `IMAGE_REFS`. If `registry_auth_secret` is set, the deploy SSH session runs `docker login <registry>` with that secret value before pulling. | Vendor app, mirrored binary, fleet-rebrand of an upstream image. |

The `plan` command emits `image_source` (`"build"` / `"upstream"` / `""`) and `upstream_image_refs` (JSON Record). `compute-image-ref` emits `image_refs` (JSON Record, same shape) + `bake_file` (the basename of the `docker-bake.json` it renders from `nextnode.toml`). The workflow YAML routes past `build-image` without inline conditionals.

## Image naming (build mode)

Computed by `computeImageRef({ repository, sha, service })` in `domain/deploy/image-ref.ts`:

- Registry: `ghcr.io`
- Repository: `<owner>/<repo>-<service>` lowercased (per-service suffix so each declared service publishes to its own GHCR path)
- Tag: `sha-<first 7 chars of GITHUB_SHA>`

Example: `NextNodeSolutions/Core` @ `abc1234567890…` with `[deploy.services.web]` → `ghcr.io/nextnodesolutions/core-web:sha-abc1234`.

The full per-service Record is resolved by `resolveServiceImageRefs(services, repository, sha)`: `build` services get a fresh computed ref + are added to the bake-target list that `renderBakeFile` turns into `docker-bake.json`; `upstream` services keep their declared `ref` verbatim (round-tripped through `parseImageRef` for validation). `compute-image-ref` is the single source of truth — any ref string constructed by hand is a bug.

## Local dev

There is no caller `docker-compose.yml`. Build and run the image directly with the same Dockerfile CI uses — the commands are exactly the Definition of Done smoke test below. In CI that same Dockerfile is built by `docker/bake-action` against the rendered `docker-bake.json` and tagged with the GHCR ref. See [turborepo-docker.md](turborepo-docker.md#smoke-test) for the canonical monorepo build + smoke test.

## Definition of Done - pre-flight smoke test

Before pushing a commit that triggers `deploy.yml`, run the end-to-end docker smoke test and confirm the container actually serves on `$PORT`. CI takes 5+ minutes per round-trip; the local loop catches the same failures in seconds.

```bash
# from the repo root (the monorepo build context)
docker build -f packages/<pkg>/Dockerfile -t <pkg>:smoke .
docker run --rm -d --name <pkg>-smoke -p 3000:3000 -e PORT=3000 <pkg>:smoke
curl -fsS http://localhost:3000/      # expect 200
docker logs --tail 50 <pkg>-smoke     # check for crash-loops
docker rm -f <pkg>-smoke
```

What this catches that a green `pnpm build` does NOT:

- **Missing `dist/` in the deployed bundle.** `pnpm deploy` follows npm's packlist: with no `"files"` field in the package's `package.json`, gitignored entries (typically `dist/`) are excluded. Container starts, fails with `Cannot find module '.../dist/server/entry.mjs'`, crash-loops. Declare `"files": ["dist"]` (or specific subpaths) in the package's `package.json`, like the workspace libraries already do.
- **`HOST` binding for SSR servers.** `@astrojs/node` standalone (and most Node SSR runtimes) default to `localhost`/`127.0.0.1`, which Docker port-mapping cannot reach. Set `host: true` in the Astro config or export `HOST=0.0.0.0` in the runtime env.
- **Workspace dep `dist/` not built.** Caught by Rule 6 already (topological filter), but the smoke test confirms every consumer resolves at runtime, not just at build time.
- **Wrong working directory or entry path.** The Dockerfile's `WORKDIR` and `CMD` must match what `pnpm deploy` actually outputs. The smoke test surfaces this immediately.

A green smoke test is mandatory before pushing - treat it like `pnpm test` for deploys.

## Rules

1. **Service name comes from `[deploy.services.<name>]`, never hardcoded** - the declared instance name flows end-to-end (bake target, GHCR repo suffix, VPS compose service key, `.env.<name>` file, Caddy upstream, migrate-container image lookup). Any literal `"app"` reaching for the service slot is a bug.
2. **`nextnode.toml` is the single source of truth for build shape** - the caller ships no `docker-compose.yml`; `compute-image-ref` renders `docker-bake.json` from the `[deploy.services.<name>]` tables. `image:` comes from the rendered bake file's `<target>.tags`, never hand-authored.
3. **Respect `$PORT`** - read `process.env.PORT` (12-factor). The infra sets it from `[deploy.services.<name>].port` (default 3000) and uses the SAME value for the compose port mapping and the `/healthz` probe. Never hardcode a listening port in the app.
4. **Everything non-build-related is infra-owned** - ports, env vars, restart policy, healthcheck, volumes all belong to the infra layer.
5. **Image naming is centralized** - `computeImageRef` / `resolveServiceImageRefs` are the only normalizers. Never reconstruct `ghcr.io/...:sha-...` by hand and never serialize a bare ref string into pipeline outputs — `IMAGE_REFS` is a JSON Record consumed by `parseImageRefsEnv`.
6. **Monorepo callers delegate the Dockerfile build strategy to [turborepo-docker.md](turborepo-docker.md)** - the `turbo prune --docker` pattern is provider-agnostic. The Hetzner caller only owns the runtime contract (port from config, declared service name, infra-owned compose keys, `/healthz` for build).
7. **Smoke-test the image with `docker build` + `docker run` locally before pushing a deploy** - Definition of Done for any change that triggers `deploy.yml`. See the pre-flight section above and [turborepo-docker.md](turborepo-docker.md#smoke-test).
8. **All services in one project share the same `source`** - if a project genuinely needs both, split it into two `nextnode.toml`s (two workflows, two VPS silos) — there is no per-service auth/bake escape hatch.
9. **Routed services need a unique `url` within `project.domain`** - one DNS record + Caddy upstream + host port per routed service. Services without `url` are internal-only on the compose network. Cross-service URLs are auto-injected into each `.env.<name>` as `<SIBLING_NAME>_URL=https://...` (symmetric, including self) — never hardcode peer hostnames in caller code.
