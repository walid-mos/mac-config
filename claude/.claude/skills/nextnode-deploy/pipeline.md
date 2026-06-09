# Pipeline Architecture

## Workflows

Three reusable workflows + standalone ops workflows.

**Reusable (called via `workflow_call` from caller repos)**:
- `publish-package.yml` - `type=package`
- `deploy.yml` - `type=app` (Hetzner VPS)
- `deploy-static.yml` - `type=static` (Cloudflare Pages)

**Standalone ops workflows (live in `NextNodeSolutions/core/.github/workflows/`)**:
- `build-golden-image.yml` - `workflow_dispatch`. Triggers the `build-golden-image` CLI command. See [golden-image.md](golden-image.md).
- `teardown-vps.yml` - `workflow_dispatch`. Tears down a Hetzner VPS (server + DNS + state).
- `teardown-pages.yml` - `workflow_dispatch`. Tears down a Cloudflare Pages project (project + domains + R2 if any).

Callers choose one of the three deploy workflows based on `type` (no runtime routing in YAML):

### `publish-package.yml` (type=package)

```
plan -> quality (matrix) -> publish (semantic-release)
```

- Publish only runs on `main` branch and when `plan.outputs.publish == 'true'`
- Uses `semantic-release` via `pnpm exec` (plugins come from `@nextnode-solutions/standards` deps)
- After publish: runs `publish-result` command to parse output and write summary
- Requires `NEXTNODE_APP_ID`, `NEXTNODE_APP_PRIVATE_KEY`, `NPM_TOKEN` secrets
- Does NOT pass `PIPELINE_ENVIRONMENT` - the CLI auto-resolves environment to `'none'` when `type=package`

### `deploy.yml` (type=app - Hetzner VPS)

```
plan ---+--- quality (matrix with prod-gate if prod)
        |
        +--- provision (needs quality) --- dns (conditional, needs provision)
        |
        +--- build-image (needs quality + image_source == "build")
        |
        +--- migrate (needs provision + build-image + has_postgres == "true")
        |
        \--- deploy (needs provision + build-image + migrate)
```

Inputs:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `environment` | string | required | `development` or `production` |
| `config_file` | string | `nextnode.toml` | Path to nextnode.toml in the caller repo |
| `dev_workflow_file` | string | `deploy-dev.yml` | Filename of dev workflow (for prod gate) |

Jobs:

| Job | Depends on | What it does |
|-----|-----------|-------------|
| `plan` | -- | Parse config, output quality matrix + project_name + has_prod_gate + has_domain + has_postgres + image_source + upstream_image_refs |
| `quality` | plan | Run lint/test/prod-gate matrix |
| `provision` | plan + quality | `node src/index.ts provision` - ensure Hetzner VPS, Tailscale join, firewall, convergence (Caddy/Vector) |
| `dns` | plan + quality + provision | `node src/index.ts dns` - reconcile Cloudflare DNS A records. **Only runs if `has_domain == 'true'`** |
| `build-image` | plan + quality | `compute-image-ref` CLI renders `docker-bake.json` from `nextnode.toml` at the workspace root and emits `image_refs` (JSON Record) + `bake_file` (its basename). A single `docker/bake-action` (`source: .`, `files: <bake_file>`) runs all `build` targets in one shot, pushes to GHCR, uses GHA layer cache scoped per target. **Skipped when `image_source == "upstream"`** — plan's `upstream_image_refs` carries the refs instead. |
| `migrate` | plan + provision + build-image | `node src/index.ts migrate-remote` — stage rollout + take pre-migrate R2 snapshot + run `migrate_command` in an ephemeral container on the project network. **Only runs if `has_postgres == 'true'`.** Receives `IMAGE_REFS` (JSON Record) — built path from `build-image`, upstream path from plan. |
| `deploy` | plan + provision + build-image + migrate | `node src/index.ts deploy` - SSH to VPS, render per-service compose + `.env.<name>` files, docker compose pull, bring postgres up (phase 1), rotate user services (phase 2), reload Caddy. |

Permissions (declared at workflow level): `contents: read`, `actions: read`, `packages: write` (GHCR push).

Secrets (all live at the **GitHub org level** on `NextNodeSolutions` - callers only need `secrets: inherit`, no per-repo configuration):

- `HETZNER_API_TOKEN`
- `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` (Tailscale OAuth for runner + VPS join)
- `DEPLOY_SSH_PRIVATE_KEY_B64` (base64-encoded SSH private key; public key derived at runtime)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (self-healed by `ensureR2Setup` and re-published as org secrets on rotation)
- `NEXTNODE_APP_ID`, `NEXTNODE_APP_PRIVATE_KEY` (GitHub App for minting `GH_TOKEN` in provision)

**Tailscale**: Both `provision` and `deploy` jobs connect the CI runner to the tailnet via `tailscale/github-action@v4` with OAuth credentials. SSH to the VPS goes through the tailnet IP - never the public IP.

**Image ref flow**: build path — `build-image` runs `node src/index.ts compute-image-ref`, which renders a `docker-bake.json` from `nextnode.toml` (`renderBakeFile` in `domain/deploy/bake-file.ts`), writes it at the workspace root (`writeBakeFile` in `adapters/build-output/bake-file.ts`), and writes `image_refs` (JSON Record `{<service>: {registry, repository, tag}}`) + `bake_file` (the basename) to `GITHUB_OUTPUT`. `docker/bake-action` consumes it with `source: .` + `files: <bake_file>` — the rendered file holds every `build` target's `context` / `dockerfile` / optional stage `target` / `tags` / per-target GHA cache, so one bake call covers every `build` service. `nextnode.toml` is the single source of truth for build shape — the caller ships no docker-compose.yml. `image_refs` is forwarded to the `migrate` and `deploy` jobs as `IMAGE_REFS`. Upstream path — `build-image` is skipped; `plan`'s `upstream_image_refs` (parsed from `[deploy.services.<name>].ref`, validated through `parseImageRef`) is the JSON fed as `IMAGE_REFS`. Both paths produce the SAME JSON shape, consumed by `parseImageRefsEnv` on the deploy side. Projects never reference `ghcr.io/…` in their own code.

**DNS reconciliation**: The `dns` job runs after provision and creates/updates Cloudflare A records — **one A record per routed service** (each `[deploy.services.<name>]` that declares a `url`). Internal projects point to the Tailscale CGNAT IP (unproxied). Public projects point to the VPS public IP (proxied in production, unproxied in development).

**Multi-service**: N services per project are accepted, with strict cross-service rules — single `source` (all `build` or all `upstream`), unique `url` within `project.domain`, exactly one `needs = ["postgres"]` owner when postgres is declared, homogeneous `registry_auth_secret` across upstream services. Per-service primitives wired today: image refs (`Record<service, ImageRef>`), `.env.<name>` files with symmetric cross-service URL injection, host-port allocation per routed service, DNS record + Caddy upstream per routed service, `depends_on` gating that adapts to Y's source (`service_healthy` for build, `service_started` for upstream). Still single-service-only: `[deploy.volumes]` mounts (primary service only), postgres database, supabase stack, healthcheck command. See [multi-service.md](multi-service.md).

See [hetzner-caller.md](hetzner-caller.md) for the caller-side project convention (Dockerfile, `nextnode.toml` build shape, infra-owned runtime concerns).

### `deploy-static.yml` (type=static - Cloudflare Pages)

```
plan ---+--- quality (matrix with prod-gate if prod)
        +--- provision (Pages project)
        +--- dns (CNAME reconciliation, if domain)
        \--- deploy (build -> seo-guard -> wrangler pages deploy)
```

Inputs:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `environment` | string | required | `development` or `production` |
| `config_file` | string | `nextnode.toml` | Path to nextnode.toml in the calling repo |
| `dev_workflow_file` | string | `deploy-dev.yml` | Filename of the dev workflow (for prod gate) |

Jobs:

| Job | Depends on | What it does |
|-----|-----------|-------------|
| `plan` | -- | Parse config, output matrix + project name + build_directory |
| `quality` | plan | Run lint/test/prod-gate matrix |
| `provision` | plan | Create CF Pages project, attach domains, sync env vars |
| `dns` | plan + provision | Reconcile Cloudflare DNS CNAMEs (only if domain configured) |
| `deploy` | plan + quality + provision | Deploy command -> pnpm build -> SEO guard -> wrangler pages deploy |

Plan outputs:

| Key | Source | Used by |
| --- | ------ | ------- |
| `quality_matrix` | `buildQualityMatrix()` | quality job matrix |
| `project_name` | `computePagesProjectName()` | deploy + provision jobs |
| `has_prod_gate` | `hasProdGate(quality_matrix)` | quality job `infra:` input |
| `has_domain` | `Boolean(config.project.domain)` | conditional dns job |
| `build_directory` | computed from config file path | SEO guard + wrangler deploy |

## The `environment` input

Both `deploy.yml` and `deploy-static.yml` are generic - the caller invokes them twice (once per env) from two thin caller-repo workflows:

```yaml
# caller-repo/.github/workflows/deploy-dev.yml
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: development
    secrets: inherit

# caller-repo/.github/workflows/deploy-prod.yml
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: production
    secrets: inherit
```

The CI passes the workflow's `environment` input to CLI commands via `PIPELINE_ENVIRONMENT` env var.

## The `dev_workflow_file` input

Multi-app repos with custom workflow names (e.g. `landing-dev.yml` instead of `deploy-dev.yml`) pass this input so the prod gate can find the correct dev run:

```yaml
# caller-repo/.github/workflows/landing-prod.yml
jobs:
  pipeline:
    uses: NextNodeSolutions/core/.github/workflows/deploy-static.yml@main
    with:
      environment: production
      dev_workflow_file: landing-dev.yml
    secrets: inherit
```

Passed as `DEV_WORKFLOW_FILE` env var in the quality step. The CLI prepends `.github/workflows/` to build the full path for matching against the GitHub API response.

## Quality matrix

Generated by `buildQualityMatrix(scripts, project, pipeline)`:

| Task | Condition | Command |
| ---- | --------- | ------- |
| `lint` | `scripts.lint` is not false | `pnpm {lint}` or `pnpm turbo run {lint} --filter={filter}` |
| `test` | `scripts.test` is not false | `pnpm {test}` or `pnpm turbo run {test} --filter={filter}` |
| `prod-gate` | `environment=production` AND `developmentEnabled=true` | `cd .infra/packages/infrastructure && node src/index.ts prod-gate` |

Empty matrix -> skip sentinel (`{ id: 'skip', cmd: 'echo skipped' }`).

## prod-gate

- Calls GitHub API `GET /repos/{repo}/actions/runs?head_sha={sha}`
- Looks for a run matching `.github/workflows/{DEV_WORKFLOW_FILE}` with `status=completed` + `conclusion=success`
- `DEV_WORKFLOW_FILE` defaults to `deploy-dev.yml` when not set
- When present in the quality matrix, the quality job checks out `.infra` too via `infra: ${{ needs.plan.outputs.has_prod_gate }}`
- Requires `actions: read` permission and `GH_TOKEN` env var

## SEO guard step

Runs in the deploy job between `pnpm build` and `wrangler pages deploy` (working dir `.infra/packages/infrastructure`, env: `PIPELINE_CONFIG_FILE`, `PIPELINE_ENVIRONMENT`, `BUILD_DIRECTORY`). Production: no-op. Development: injects `_headers` (X-Robots-Tag: noindex) and `robots.txt` (Disallow: /).

## DNS reconciliation (dns job)

Runs only when `has_domain == 'true'`. Reconciles CNAMEs (creates or updates, never deletes), zone lookup cached per root domain:
- Production: `{domain}` + `redirect_domains` -> `{project}.pages.dev` (proxied, TTL=1)
- Development: `dev.{domain}` -> `{project}-dev.pages.dev` (unproxied, TTL=300)

## Cloudflare Pages composite action

`.github/actions/deploy-cloudflare-pages/action.yml` wraps `npx wrangler pages deploy`. Required inputs: `directory`, `project-name`, `account-id`, `api-token`. Always deploys to `--branch=main` (dev and prod both treat main as production branch).
