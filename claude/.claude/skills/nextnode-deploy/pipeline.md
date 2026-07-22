# Pipeline Architecture

## Workflows

Four reusable workflows + standalone ops workflows.

**Reusable (called via `workflow_call` from caller repos)**:
- `publish-package.yml` - `type=package`
- `deploy.yml` - `type=app` (Hetzner VPS)
- `deploy-static.yml` - `type=static` (Cloudflare Pages)
- `deploy-workers.yml` - `type=app` with `target = "cloudflare-workers"` (Cloudflare Workers). See [cloudflare-workers.md](cloudflare-workers.md).
- `plan-workers-diff.yml` - `workflow_call`, PR-only Terraform plan diff for the Workers target (below).

**Standalone ops workflows (live in `NextNodeSolutions/core/.github/workflows/`)**:
- `build-golden-image.yml` - `workflow_dispatch`. Triggers the `build-golden-image` CLI command. See [golden-image.md](golden-image.md).
- `teardown-vps.yml` - `workflow_dispatch`. Tears down a Hetzner VPS (server + DNS + state).
- `teardown-pages.yml` - `workflow_dispatch`. Tears down a Cloudflare Pages project (project + domains + R2 if any).
- `teardown-workers.yml` - `workflow_dispatch`. Tears down a Cloudflare Workers project (Worker scripts via wrangler + `terraform destroy`; HCP workspace kept). See [cloudflare-workers.md](cloudflare-workers.md).

Callers choose the deploy workflow: `type` selects package/app/static, and an `app` project on `target = "cloudflare-workers"` points at `deploy-workers.yml` instead of `deploy.yml` (no runtime routing in YAML):

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
        +--- detect-migration-changes (outputs migrations_changed)
        |
        +--- migrate (needs provision + build-image + has_postgres == "true" + migrations_changed == "true")
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
| `build-image` | plan + quality | `compute-image-ref` CLI renders `docker-bake.json` from `nextnode.toml` at the workspace root and emits `image_refs` (JSON Record) + `bake_file` (its basename). A single `docker/bake-action` (`source: .`, `files: <bake_file>`) runs all `build` targets in one shot, pushes to GHCR, uses a two-layer cache: a fast ephemeral GHA scope (listed first) + a durable registry scope (`type=registry,ref=ghcr.io/<repo>-<service>:buildcache`, `mode=max,ignore-error=true`) that survives GHA eviction and keeps layers warm across runs. **Skipped when `image_source == "upstream"`** — plan's `upstream_image_refs` carries the refs instead. |
| `detect-migration-changes` | -- | `node src/index.ts detect-migration-changes` — compares the `base..head` git range against `migrations_folder` (default `drizzle/`) and emits `migrations_changed`. **Fails safe to `true`** on an undiffable range (first push, manual dispatch, shallow-clone git failure) so a needed migration is never skipped. |
| `migrate` | plan + provision + build-image + detect-migration-changes | `node src/index.ts migrate-remote` — stage rollout + run `migrate_command` in an ephemeral container on the project network. No pre-migrate snapshot (wal-g continuous archiving covers it). **Only runs if `has_postgres == 'true'` AND `migrations_changed == 'true'`.** Receives `IMAGE_REFS` (JSON Record) — built path from `build-image`, upstream path from plan. |
| `deploy` | plan + provision + build-image + migrate | `node src/index.ts deploy` - SSH to VPS, render per-service compose + `.env.<name>` files, docker compose pull, bring postgres up (phase 1), rotate user services (phase 2), reload Caddy. |

Permissions (declared at workflow level): `contents: read`, `actions: read`, `packages: write` (GHCR push).

Infra secrets live at the **GitHub org level** on `NextNodeSolutions` — callers only need `secrets: inherit`, no per-repo configuration. Do NOT maintain a secret list here: query it live and read the consuming workflow to know what each one is for. See [github-org.md](github-org.md) for the full layer model (org / repo-env / repo), retrieval commands, and the `nextnode-ci` GitHub App that mints `GH_TOKEN`.

```sh
gh secret list --org NextNodeSolutions
```

**Tailscale**: Both `provision` and `deploy` jobs connect the CI runner to the tailnet via `tailscale/github-action@v4` with OAuth credentials. SSH to the VPS goes through the tailnet IP - never the public IP.

**Image ref flow**: build path — `compute-image-ref` renders `docker-bake.json` from `nextnode.toml` (`renderBakeFile` in `domain/deploy/bake-file.ts`), writes it at the workspace root (`writeBakeFile` in `adapters/build-output/bake-file.ts`), and emits `image_refs` (JSON Record) + `bake_file` to `GITHUB_OUTPUT`; `docker/bake-action` consumes it with `source: .` + `files: <bake_file>`. Upstream path — `build-image` is skipped; `plan`'s `upstream_image_refs` is fed as `IMAGE_REFS`. Both paths produce the SAME JSON shape, consumed by `parseImageRefsEnv`. Projects never reference `ghcr.io/…` in their own code.

**DNS reconciliation**: The `dns` job runs after provision and creates/updates Cloudflare A records — **one A record per routed service** (each `[deploy.services.<name>]` that declares a `url`). Internal projects point to the Tailscale CGNAT IP (never proxied). Public projects point to the VPS public IP: proxied in production only for the apex + one-label subdomains Universal SSL covers, grey-clouded (DNS-only) for two+ label subdomains so Caddy's origin cert serves them, unproxied in development. See [hetzner-vps.md](hetzner-vps.md).

**Multi-service**: N services per project, with strict cross-service rules and per-service runtime primitives — see [multi-service.md](multi-service.md).

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

Plan outputs: see the full table in [config.md](config.md) → "Plan outputs".

### `deploy-workers.yml` (type=app + `target = "cloudflare-workers"` - Cloudflare Workers)

```
plan ---+--- quality (matrix with prod-gate folded in when producing prod)
        |
        +--- provision (terraform apply; needs plan + quality)
        |
        +--- detect-migrations (needs plan; if has_d1)
        |
        +--- migrate (needs plan + provision + detect-migrations; if has_d1 && migrations_changed)
        |
        \--- deploy (needs plan + quality + provision + migrate)
```

Inputs: `environment` (required), `config_file` (default `nextnode.toml`), `dev_workflow_file` (default `deploy-dev.yml`) — the same contract as the other two.

Jobs:

| Job | Depends on | What it does |
|-----|-----------|-------------|
| `plan` | -- | Parse config, output `quality_matrix` + `project_name` + `has_prod_gate` + `has_domain` + `has_d1` + `package_dir` |
| `quality` | plan | Run lint/test/**prod-gate** matrix — the prod gate is a matrix task (via `has_prod_gate` + `dev_workflow_file`), NOT a separate job |
| `provision` | plan + quality | `node src/index.ts provision` — ensure the HCP workspace, `terraform apply` (D1/KV/Queues/R2 + DNS + Redirect Rules), map outputs → ServiceEnv. DNS is absorbed here — **no standalone `dns` job**. |
| `detect-migrations` | plan | `node src/index.ts detect-migration-changes` — emit `migrations_changed` (base `PIPELINE_BASE_SHA`). Runs only if `has_d1 == 'true'`. Fails safe to `true` on an undiffable range. |
| `migrate` | plan + provision + detect-migrations | `node src/index.ts migrate-remote` (the shared command; the Workers target dispatches it to `wrangler d1 migrations apply <db> --remote`) between provision and deploy. Runs only if `has_d1 == 'true'` AND `migrations_changed == 'true'`. |
| `deploy` | plan + quality + provision + migrate | `node src/index.ts deploy` — build + inject SEO guard per service + generate the ephemeral `wrangler.json` + `wrangler deploy` (in `depends_on` order) + `/healthz` smoke check, all in one CLI step. **No separate `seo-guard` step.** |

**No `build-image` job** (no Docker build), **no `dns` job** (folded into provision), **no `prod-gate` job** (folded into `quality`). Terraform is set up per job with `hashicorp/setup-terraform@v3` (`terraform_version: '~> 1.9'`, `terraform_wrapper: false`); `wrangler` runs via `npx --yes` from the app's devDependency.

CLI env vars: the Cloudflare subset + `TF_TOKEN_app_terraform_io` (from the `TF_API_TOKEN` org secret), `ALL_SECRETS`, `GH_TOKEN`. **No Hetzner/SSH/Tailscale vars.** Full table in [config.md](config.md) → "Cloudflare Workers commands". See [cloudflare-workers.md](cloudflare-workers.md) for the caller convention (no Dockerfile, no committed wrangler config).

### `teardown-workers.yml` (`workflow_dispatch`)

Parity with `teardown-vps.yml` / `teardown-pages.yml`. Inputs: `repository` (target `owner/repo`), `environment` (choice), `confirm` (type the project name → `TEARDOWN_CONFIRM`), `wipe_data` (boolean → `TEARDOWN_WIPE_DATA`, **required when D1 or R2 is declared**), `config_file`. Sparse-checks-out the target repo, runs `teardown-guard` then `teardown` — deletes every Worker script via `wrangler delete --force`, then `terraform destroy`; the HCP workspace is kept so state history survives.

### `plan-workers-diff.yml` (`workflow_call`)

PR-only Terraform diff for the Workers target. Inputs `environment` + `config_file`; permission `pull-requests: write`. The caller triggers it on `nextnode.toml` changes and it runs `node src/index.ts plan-infra` (`terraform plan -detailed-exitcode`), commenting the create/update/delete diff on the PR (`PIPELINE_PR_NUMBER` + `GH_TOKEN`) so a reviewer sees the infra change before merge. The plan is env-specific (workspace `<project>-<env>`).

```yaml
# caller-repo/.github/workflows/plan-infra.yml
on:
  pull_request:
    paths: ['**/nextnode.toml']
jobs:
  plan-infra:
    uses: NextNodeSolutions/core/.github/workflows/plan-workers-diff.yml@main
    with:
      environment: development
      config_file: apps/web/nextnode.toml
    secrets: inherit
```

## The `environment` input

`deploy.yml`, `deploy-static.yml`, and `deploy-workers.yml` are all generic - the caller invokes one twice (once per env) from two thin caller-repo workflows:

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
