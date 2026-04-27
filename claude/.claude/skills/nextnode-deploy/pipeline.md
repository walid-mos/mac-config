# Pipeline Architecture

## Workflows

Three reusable workflows + standalone ops workflows.

**Reusable (called via `workflow_call` from caller repos)**:
- `publish-package.yml` — `type=package`
- `deploy.yml` — `type=app` (Hetzner VPS)
- `deploy-static.yml` — `type=static` (Cloudflare Pages)

**Standalone ops workflows (live in `NextNodeSolutions/core/.github/workflows/`)**:
- `build-golden-image.yml` — `workflow_dispatch`. Triggers the `build-golden-image` CLI command. See [golden-image.md](golden-image.md).
- `teardown-vps.yml` — `workflow_dispatch`. Tears down a Hetzner VPS (server + DNS + state).
- `teardown-pages.yml` — `workflow_dispatch`. Tears down a Cloudflare Pages project (project + domains + R2 if any).

Callers choose one of the three deploy workflows based on `type` (no runtime routing in YAML):

### `publish-package.yml` (type=package)

```
plan -> quality (matrix) -> publish (semantic-release)
```

- Publish only runs on `main` branch and when `plan.outputs.publish == 'true'`
- Uses `semantic-release` via `pnpm exec` (plugins come from `@nextnode-solutions/standards` deps)
- After publish: runs `publish-result` command to parse output and write summary
- Requires `NEXTNODE_APP_ID`, `NEXTNODE_APP_PRIVATE_KEY`, `NPM_TOKEN` secrets
- Does NOT pass `PIPELINE_ENVIRONMENT` — the CLI auto-resolves environment to `'none'` when `type=package`

### `deploy.yml` (type=app — Hetzner VPS)

```
plan ---+--- quality (matrix with prod-gate if prod)
        |
        +--- provision (needs quality) --- dns (conditional, needs provision)
        |
        +--- build-image (needs quality)
        |
        \--- deploy (needs provision + build-image)
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
| `plan` | -- | Parse config, output quality matrix + project_name + has_prod_gate + has_domain |
| `quality` | plan | Run lint/test/prod-gate matrix |
| `provision` | plan + quality | `node src/index.ts provision` — ensure Hetzner VPS, Tailscale join, firewall, convergence (Caddy/Vector) |
| `dns` | plan + quality + provision | `node src/index.ts dns` — reconcile Cloudflare DNS A records. **Only runs if `has_domain == 'true'`** |
| `build-image` | plan + quality | `compute-image-ref` CLI + `docker/bake-action@v6` (targets `app`, push to GHCR, GHA cache) |
| `deploy` | plan + provision + build-image | `node src/index.ts deploy` — SSH to VPS, write .env, docker compose pull + up, reload Caddy |

Permissions (declared at workflow level): `contents: read`, `actions: read`, `packages: write` (GHCR push).

Secrets (all live at the **GitHub org level** on `NextNodeSolutions` — callers only need `secrets: inherit`, no per-repo configuration):

- `HETZNER_API_TOKEN`
- `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` (Tailscale OAuth for runner + VPS join)
- `DEPLOY_SSH_PRIVATE_KEY_B64` (base64-encoded SSH private key; public key derived at runtime)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (self-healed by `ensureR2Setup` and re-published as org secrets on rotation)
- `NEXTNODE_APP_ID`, `NEXTNODE_APP_PRIVATE_KEY` (GitHub App for minting `GH_TOKEN` in provision)

**Tailscale**: Both `provision` and `deploy` jobs connect the CI runner to the tailnet via `tailscale/github-action@v4` with OAuth credentials. SSH to the VPS goes through the tailnet IP — never the public IP.

**Image ref flow**: `build-image` job runs `node src/index.ts compute-image-ref` to write `image_ref` to `GITHUB_OUTPUT`. Value is then injected into `docker/bake-action` via `set: app.tags=<ref>` and forwarded to the `deploy` job as `IMAGE_REF` env var. This is the single source of truth — projects never reference `ghcr.io/…` in their own code.

**DNS reconciliation**: The `dns` job runs after provision and creates/updates Cloudflare A records. Internal projects get an A record pointing to the Tailscale CGNAT IP (unproxied). Public projects get an A record pointing to the VPS public IP (proxied in production, unproxied in development).

**Multi-service is NOT supported** — compose generation hardcodes a single service named `app`. The `build-image` job also targets only `app`. Caller projects are mono-service today; multi-service is a future extension.

See [hetzner-caller.md](hetzner-caller.md) for the caller-side project convention (docker-compose.yml shape, Dockerfile, forbidden keys).

### `deploy-static.yml` (type=static — Cloudflare Pages)

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

Both `deploy.yml` and `deploy-static.yml` are generic — the caller invokes them twice (once per env) from two thin caller-repo workflows:

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

Runs in the deploy job, after `pnpm build` and before wrangler pages deploy:

```yaml
- name: SEO guard
  run: node src/index.ts seo-guard
  working-directory: .infra/packages/infrastructure
  env:
      PIPELINE_CONFIG_FILE: ${{ github.workspace }}/${{ inputs.config_file }}
      PIPELINE_ENVIRONMENT: ${{ inputs.environment }}
      BUILD_DIRECTORY: ${{ github.workspace }}/${{ needs.plan.outputs.build_directory }}
```

For production: no-op. For development: injects `_headers` (X-Robots-Tag: noindex) and `robots.txt` (Disallow: /) into the build directory.

## DNS reconciliation (dns job)

Runs only when `has_domain == 'true'`. Reconciles CNAME records:
- Production: `{domain}` + `redirect_domains` -> `{project}.pages.dev` (proxied, TTL=1)
- Development: `dev.{domain}` -> `{project}-dev.pages.dev` (unproxied, TTL=300)

Uses zone lookup caching per root domain. Creates or updates records, never deletes.

## Cloudflare Pages composite action

Located at `.github/actions/deploy-cloudflare-pages/action.yml`. Runs `npx wrangler pages deploy`:

| Input | Required | Description |
| ----- | -------- | ----------- |
| `directory` | Yes | Path to built static assets (e.g. `dist`) |
| `project-name` | Yes | Cloudflare Pages project name |
| `account-id` | Yes | Cloudflare account ID |
| `api-token` | Yes | Cloudflare API token with Pages edit permission |

Always deploys to `--branch=main` (both dev and prod projects use main as production branch).
