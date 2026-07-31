# Cloudflare Workers Architecture

Deep-dive into the `cloudflare-workers` deploy target: the full-Cloudflare positioning, the Terraform/wrangler ownership boundary, config schema, provisioning, deploy, teardown, the reusable workflows, and the one-shot org bootstrap. This is the reference for the third `DeployTarget` alongside [hetzner-vps.md](hetzner-vps.md) (VPS deep-dive) and the caller convention (folded in below, mirroring [hetzner-caller.md](hetzner-caller.md)).

## Positioning

`cloudflare-workers` deploys a project's front + back + admin as **N Workers** entirely on Cloudflare's edge, driven by the same `nextnode.toml` the VPS target reads. Two engines split the work by lifecycle:

- **Provision = Terraform.** A pure `config → main.tf.json` generation, applied by a shell-out adapter. State lives on **HCP Terraform** (org `nextnode`), execution mode **local** (HCP stores state only; the CI runner executes the binary). Terraform owns every stateful resource: D1, KV, Queues, R2, DNS records, Redirect Rules.
- **Deploy = wrangler.** An ephemeral `wrangler.json` is generated per service (the dev commits none) and `wrangler deploy` publishes the script, its bindings, its Custom Domain, and its cron triggers.

The VPS target is untouched — each target chooses its own realization behind the `DeployTarget` interface (SKILL.md rule 5). Inference is unchanged: `app → hetzner-vps`, `static → cloudflare-pages` (`DEFAULT_DEPLOY_TARGETS`); **`cloudflare-workers` is never a default and must be set explicitly** in `[deploy]`.

## Terraform / wrangler ownership boundary

The single load-bearing decision of this target: **exactly one owner per resource.** A resource managed by both Terraform and wrangler drifts on every deploy.

| Owner | Resources |
|-------|-----------|
| **Terraform** | D1 databases, KV namespaces, Queues, R2 buckets (+ R2 custom domains), DNS records, Redirect Rulesets. The DNS zone is read as a `data` source, never a managed resource. |
| **wrangler** | The Worker script, its bindings (D1/KV/R2/Queues), its Custom Domain route, its cron triggers. |

No `cloudflare_workers_script` (nor any worker custom-domain resource) is ever generated in the `.tf` — those live on the wrangler side. Conversely, wrangler never creates the backing resources: it only references the ids Terraform emitted as outputs. The `redeploy = no-op` e2e scenario guards the boundary.

## Config: the `nextnode.toml`

Full field reference lives in [config.md](config.md); this section is the target-shaped summary.

```toml
[project]
name = "studiobymina"
type = "app"
domain = "studiobymina.com"
redirect_domains = ["studiobymina.fr"]

[deploy]
target = "cloudflare-workers"                # explicit — never inferred
secrets = [{ name = "JWT_SECRET", generate = "token", length = 43 }]

[deploy.services.web]
url = "studiobymina.com"
needs = ["back"]                             # service binding -> env.BACK (a Fetcher)

[deploy.services.back]
url = "api.studiobymina.com"
needs = ["d1", "planetscale"]                # -> env.DB + env.HYPERDRIVE
secrets = ["RESEND_API_KEY"]
observability = false                        # opt out of Workers Logs on the hot path

[deploy.services.admin]
url = "admin.studiobymina.com"

[services.d1]
migrations_folder = "drizzle"

[services.planetscale]
cluster_size = "PS-10"                       # optional; org default when omitted
```

### `[deploy.services.<name>]` — one block, one Worker

A Worker is not a container, so the schema (`WorkerServiceConfig`) is the runtime-wiring subset plus a bundle `entry`:

| Field | Meaning |
|-------|---------|
| `url` | Custom Domain hostname. Unique across services and within `project.domain` (equal or a sub-domain). Absent = internal-only Worker, reachable through service bindings, no route. |
| `secrets` | Per-service RUNTIME secret NAMES (least-privilege), resolved from `ALL_SECRETS`. |
| `needs` | Backing services AND/OR sibling Workers this Worker binds. Backing: `["d1"]`, `["kv"]`, `["queues"]`, `["r2"]`, `["planetscale"]`. A name matching a sibling `[deploy.services.<name>]` becomes a service binding (see below). Drives which bindings appear in its wrangler config and the deploy order. |
| `depends_on` | Extra sibling ordering (on top of the `needs` binding graph) — deploy walks services in dependency order. |
| `entry` | The bundle `main` wrangler deploys. Default `dist/server/entry.mjs` (`DEFAULT_WORKER_ENTRY`) — what `@astrojs/cloudflare` v14 emits, with its twin static-assets directory at `dist/client`. Overridable per service. |
| `observability` | Workers Logs toggle, default `true`. The generated config always emits `observability: { enabled: <this> }`; set `false` to opt out on high-traffic Workers near the 20M-events/month Paid allowance. |
| `rate_limit` / `public_paths` / `limits` / `[[rate_limiters]]` | The four barriers — see the zone-firewall section below, and check the plan gates before declaring any of them. |

**Container-only fields are rejected** with an action-oriented message. The rejected keys are `port`, `source`, `ref`, `registry_auth_secret`, `context`, `dockerfile`, `target`, `build_args`. The template (`deploy-worker-services.ts`):

```
deploy.services.<name>.<field> is not supported with deploy target "cloudflare-workers" (a Worker is not a container: <why>)
```

e.g. `build_args` → `... (a Worker is not a container: it has no Docker build - point \`entry\` at the bundle and drop \`build_args\`)`; `dockerfile` → `... it has no Dockerfile - drop \`dockerfile\``.

Cross-service `url` rules carry over from the VPS target: each routed `url` is unique and within `project.domain` (SKILL.md rule 18). Worker-to-worker addressing does NOT use the VPS's symmetric `<NAME>_URL` injection (rule 19) — it is a service binding only (SKILL.md rule 31, see below).

### Zone firewall: the four barriers around a Worker

```toml
[deploy.services.web]
url = "example.com"
public_paths = ["/webhooks/*", "/health"]  # absent = the whole worker is public

[deploy.services.web.rate_limit]           # ZONE rate limiting rule (production only)
paths = ["/api/contact"]                   # exact path, or a trailing "*"; a "*" elsewhere is refused
methods = ["POST"]                         # optional
requests_per_period = 5
period = 60                                # default DEFAULT_RATE_LIMIT_PERIOD
mitigation_timeout = 600                   # default DEFAULT_RATE_LIMIT_MITIGATION_TIMEOUT

[deploy.services.web.limits]               # wrangler, both environments
cpu_ms = 5000                              # default DEFAULT_WORKER_CPU_MS
subrequests = 50                           # default DEFAULT_WORKER_SUBREQUESTS

[[deploy.services.web.rate_limiters]]      # in-Worker binding env.RL_FORMS: RateLimit
name = "forms"
limit = 5
period = 60                                # 10 or 60 only
```

`rate_limit` → a `cloudflare_ruleset` of phase `http_ratelimit` per worker; `public_paths` → ONE `http_request_firewall_custom` ruleset holding every worker's rule (a zone owns a single entry point per phase), blocking the negation of the declared paths. **Both are emitted in production only** — a dev and a prod workspace would overwrite each other's rules on every apply, the same reason Redirect Rules are production-only. The development deployment is therefore ungated on `dev.<host>`. A `terraform destroy` removes the rules with the environment.

Refused at load (`config/validation/deploy-worker-firewall.ts` + `providers/cloudflare-workers.ts`): a barrier on a worker without `url` (a zone rule matches on the host), more than one `rate_limit` or more than five `public_paths` in the project, a path outside the grammar, a `period`/`mitigation_timeout` outside the accepted sets, a non-kebab or duplicate limiter name.

**Plan gates — do not declare these blocks blind** (details in the `cloudflare-cost` skill, RULE 0):

- **`rate_limit` needs a zone on Pro or above.** A Free zone gives a rate limiting rule only the `Path` field (`Host` is Pro, `Method` is Business), a single 10 s period, a single 10 s mitigation timeout, and no custom response — while the generator emits `http.host`, the declared period/timeout and a `429 application/json` body. On a Free zone the `cloudflare_ruleset.ratelimit_*` create is refused at `apply`.
- **`limits` needs a Workers Paid account** (account-scoped, independent from the zone plan): `wrangler deploy` fails with `code: 100328` on Free. `limits.subrequests` additionally needs wrangler ≥ 4.62, and 50 is 1/200th of the paid platform default.
- `public_paths` and `[[rate_limiters]]` work on Free.

The limiter binding runs INSIDE the Worker — the request is already billed when it rejects. Its `namespace_id` hashes project + environment + worker + limiter name (ids are unique account-wide, so two bindings sharing one share their counters).

### Backing services realized by Terraform

Declared exactly as on the VPS, but on this target the `cloudflare-workers` Terraform block realizes them (`SERVICE_SUPPORTED_TARGETS`: `d1`/`kv`/`queues`/`planetscale` are workers-only; `r2` is multi-target; `postgres`/`observability` are hetzner-only). A worker binds a backing service by listing it in `needs`.

| Block | Terraform resource | Materialized name | Worker binding (with `needs`) |
|-------|-------------------|-------------------|-------------------------------|
| `[services.d1]` | `cloudflare_d1_database` (single DB) | `<project>-<env>-d1` | `env.DB` (`WORKERS_D1_BINDING`) |
| `[[services.kv.namespaces]]` | `cloudflare_workers_kv_namespace` | `<project>-<env>-<alias>` | `KV_<ALIAS_SNAKE>` |
| `[[services.queues]]` | `cloudflare_queue` | `<project>-<env>-<alias>` | producer `QUEUE_<ALIAS_SNAKE>` |
| `[[services.r2.buckets]]` | `cloudflare_r2_bucket` (+ `cloudflare_r2_custom_domain` when `cdn = true`) | `<project>-<env>-<alias>` | `R2_<ALIAS_SNAKE>` |
| `[services.planetscale]` | `planetscale_postgres_branch_role` + `cloudflare_hyperdrive_config` (DB itself created out-of-band, see PlanetScale below) | `<project>-<env>-planetscale` (DB) / `<project>-<env>-hyperdrive` (config) | `env.HYPERDRIVE` (`WORKERS_HYPERDRIVE_BINDING`) |

`[services.d1]` carries `migrations_folder` (default `drizzle`, `DEFAULT_MIGRATIONS_FOLDER`) and an optional `check_command` (a filesystem-only migrations check on the GH runner during quality). `<ALIAS_SNAKE>` = `alias.toUpperCase().replaceAll('-', '_')`. Only ONE D1 database per project — multiple would need per-service routing D1 does not warrant.

### Worker-to-worker: service bindings ONLY

Workers reach each other through Cloudflare **service bindings** — never a shared network or peer URL (contrast the VPS's symmetric `<NAME>_URL` injection). A `needs = ["<sibling>"]` entry naming another declared `[deploy.services.<name>]` (via `deriveBoundSiblings`, `service-bindings.ts`) emits a `WranglerServiceBinding`:

- `binding = toBindingName(name)` — uppercase, dashes→underscores (`admin-api` → `ADMIN_API`).
- `service = computeWorkerScriptName(project, env, name)` — the sibling's deployed script `<project>-<env>-<name>`.

At runtime `env.<BINDING>` is a `Fetcher` (RPC on Cloudflare's edge — no DNS, no TLS, no public hostname). `buildWorkerVars` deliberately never injects a `<NAME>_URL` for a sibling Worker. The binding graph is the single source of truth: declaring a sibling in `needs` both wires the binding and orders the deploy. `orderWorkerDeploy` topologically sorts so a Worker deploys AFTER every sibling it binds (and after explicit `depends_on`); deploys are strictly sequential and a binding **cycle throws**.

### PlanetScale Postgres + Hyperdrive — `[services.planetscale]`

The managed-database backing service for Workers. A Worker binds it with `needs = ["planetscale"]` and reaches Postgres through the Cloudflare Hyperdrive binding `env.HYPERDRIVE`. Ownership splits three ways:

- **Database — create-if-absent API adapter** (`adapters/planetscale/databases.ts`, `provision-planetscale.ts`): the PlanetScale Terraform provider has no database resource, so an API adapter GETs the DB `<project>-<env>-planetscale` (org fixed `nextnode`, kind `postgresql`, auth header colon-joined `id:token`, NOT Bearer) and POSTs on 404 (with `cluster_size`/`region` only when set), polling until `ready` (5 min bound). Runs in the provision order `['hcp-workspace', 'planetscale-database', 'terraform']` — BEFORE Terraform. Fails loud if declared but `PLANETSCALE_SERVICE_TOKEN_ID`/`PLANETSCALE_SERVICE_TOKEN` are absent.
- **Role + Hyperdrive config — Terraform** (`terraform-planetscale-resources.ts`): one `planetscale_postgres_branch_role` named `hyperdrive` on branch `main`, inherited roles `['pg_read_all_data', 'pg_write_all_data']` (DML only, no DDL); one `cloudflare_hyperdrive_config` `<project>-<env>-hyperdrive` (scheme `postgres`, port `5432`) whose host/db/user/password interpolate from the branch-role's `access_host_url`/`database_name`/`username`/`password`. Provider `planetscale/planetscale ~> 1.5`, declared only when the service is present.
- **Worker env**: **no env var is projected** — origin credentials live in Terraform state only; the Worker connects through the `HYPERDRIVE` binding's connection string.

`[services.planetscale]` is the only service impliable from a bare `needs` (`SERVICE_IMPLIABLE_FROM_NEEDS`): `needs = ["planetscale"]` with no `[services.planetscale]` table provisions it with a synthesized empty config. Teardown destroys the role + Hyperdrive config but **preserves the database** (like the HCP workspace).

### Rejected blocks on this target

| Declared | Message |
|----------|---------|
| `[services.postgres]` | `[services.postgres] is not supported with deploy target "cloudflare-workers" (supported: hetzner-vps)` |
| `[services.observability]` | `[services.observability] is not supported with deploy target "cloudflare-workers" (supported: hetzner-vps)` |
| `deploy.vps` | `deploy.vps is not supported with deploy target "cloudflare-workers" (a Worker runs on Cloudflare's edge, not a pinned VPS)` |
| `[[deploy.volumes]]` | `[[deploy.volumes]] is not supported with deploy target "cloudflare-workers" (a Worker has no host filesystem - use [services.kv]/[services.d1]/[services.r2] for state)` |
| `[deploy.hetzner]` | `[deploy.hetzner] is not supported with deploy target "cloudflare-workers" (server sizing is meaningless on Cloudflare's edge)` |

## Provision (Terraform)

`provision` runs the managed resources in a fixed order — `WORKERS_MANAGED_RESOURCES = ['hcp-workspace', 'planetscale-database', 'terraform']` (`runWorkersProvision`): ensure the HCP workspace, create-if-absent the PlanetScale DB (only when `[services.planetscale]` is declared), then `terraform apply`. Even a project with no backing service still runs Terraform — it owns the Redirect Rules + support DNS records.

### Pure generation — `domain/deploy/terraform-config.ts`

`config + environment → main.tf.json` is a 100% pure function (no IO), snapshot-tested. It emits:

- The `terraform.cloud {}` block: `organization: "nextnode"` (`HCP_TERRAFORM_ORGANIZATION`, fixed), `workspaces.name: "<project>-<env>"`.
- `required_providers.cloudflare`: source `cloudflare/cloudflare`, version `~> 5.0` (`CLOUDFLARE_PROVIDER_VERSION` — the single place the provider major is materialized; a bump is a deliberate reviewed change).
- The DNS zone as `data "cloudflare_zone"` (label `zone_main`, filtered by `project.domain`; one `zone_redirect_*` data per redirect domain). **Never a `resource`** — a project owns only its own records, so a `destroy` can never take out the zone or another pipeline's records.
- Resources: `cloudflare_d1_database` (when D1 declared), `cloudflare_workers_kv_namespace`, `cloudflare_queue`, `cloudflare_r2_bucket` (+ `cloudflare_r2_custom_domain` for `cdn` buckets), `planetscale_postgres_branch_role` + `cloudflare_hyperdrive_config` (when `[services.planetscale]` declared — provider `planetscale/planetscale ~> 1.5` added only then), plus DNS records + Redirect Rulesets from `redirect_domains`.

### Redirect Rules (`.fr → .com`)

Generated from `project.redirect_domains`, **production-only** (dev emits none) — `domain/deploy/terraform-redirects.ts`:

- One `cloudflare_dns_record` per apex + `www.<domain>` (`type A`, placeholder content `192.0.2.1`, proxied, TTL automatic) so the proxied hostname exists for the rule to fire on.
- One `cloudflare_ruleset` (`kind: root`, `phase: http_request_dynamic_redirect`) with a `redirect` action, **301** status, `expression: (http.host eq "<domain>" or http.host eq "www.<domain>")`, target `concat("<siteUrl>", http.request.uri.path)`, `preserve_query_string: true`.

### Adapter — `adapters/terraform/runner.ts`

Shell-out only, zero business decisions. Exact invocations (all with `-input=false -no-color`):

| Op | Command |
|----|---------|
| init | `terraform init -input=false -no-color` |
| apply | `terraform apply ... -auto-approve -lock-timeout=5m` |
| destroy | `terraform destroy ... -auto-approve -lock-timeout=5m` |
| plan | `terraform plan ... -lock-timeout=5m -detailed-exitcode` |
| output | `terraform output -json` |

Lock timeout `5m` (`TERRAFORM_LOCK_TIMEOUT`), run timeout 900 s. The HCP token env var `TF_TOKEN_app_terraform_io` is forwarded ambiently through `process.env` (Terraform reads it natively); `account_id` is passed as `TF_VAR_account_id`. `plan` uses `-detailed-exitcode`: exit `0` = no changes, `2` = changes pending, other = failure.

### HCP workspace — `adapters/hcp/workspaces.ts`

Created by the Terraform Cloud API (`https://app.terraform.io/api/v2`) **create-if-absent** before the first `init`: `ensureHcpWorkspace` GETs `/organizations/nextnode/workspaces/<project>-<env>`; on 404 it POSTs a workspace with `execution-mode: "local"` (`EXECUTION_MODE_LOCAL`); an existing workspace is asserted to be local mode or the deploy fails with a pointer to Settings → General → Execution Mode. One workspace per project × env, no manual per-project setup.

### Outputs → ServiceEnv — `domain/cloudflare/workers/outputs-env.ts`

`terraform output -json` is read ONCE. `parseTerraformOutputs` narrows `d1_database_id`, `kv_namespace_ids`, `queue_ids`, `r2_buckets`, `r2_cdn_urls`; `buildWorkersBackingEnv` projects them into a `{public, secret}` `ServiceEnv`:

- `D1_DATABASE_ID`; `KV_NAMESPACE_<ALIAS>_ID`; `QUEUE_<ALIAS>_ID`; `R2_BUCKET_<ALIAS>` (+ `R2_BUCKET_<ALIAS>_URL` for cdn buckets); `R2_ENDPOINT` when any bucket exists.
- Merged through `mergeServiceEnvs` — the same primitive the VPS uses, with collision detection (two services claiming one env key throws; SKILL.md rule 6).

A declared-but-missing output throws `run \`infrastructure provision\` before deploy`. `ensureGeneratedSecrets` is reused verbatim for `{name, generate, length}` entries in `[deploy].secrets`. A second consecutive provision is an empty plan (idempotence).

## Deploy (wrangler)

### Generated wrangler config — `domain/cloudflare/workers/wrangler-config.ts`

One ephemeral `wrangler.json` per service, written for `wrangler deploy --config`, deployed in `depends_on` order. Shape (`buildWranglerConfig`):

- `name: <project>-<env>-<service>` (`computeWorkerScriptName` — shared with teardown so both target the same script).
- `main: <entry>`.
- `compatibility_date: "2026-07-14"` (`DEFAULT_WORKERS_COMPATIBILITY_DATE` — a fixed date freezing the workerd behaviour set; a bump is deliberate). MUST equal `WORKERS_COMPATIBILITY_DATE` in `@nextnode-solutions/standards/workers` (the local-dev pin); `compatibility-drift.test.ts` fails the build on divergence.
- `compatibility_flags: ["nodejs_compat"]` (`WORKERS_COMPATIBILITY_FLAGS` — unlocks the Node built-ins `@astrojs/cloudflare` reaches for).

**Local dev pins the same runtime.** Infrastructure is CI-only, so `wrangler dev` can't read this config. Each Workers app's `dev` script instead runs `nextnode-workers-dev` (shipped by `@nextnode-solutions/standards`), which checks the installed `workerd` is fresh enough, then injects the same `--compatibility-date`/`--compatibility-flags`. Wiring checklist + bump procedure: `nextnode-standards` skill, `workers.md`.
- `workers_dev: false` — always; no worker answers on `<name>.workers.dev`.
- `routes: [{ pattern: resolveDeployDomain(url, env), custom_domain: true }]` when `url` is set (dev prefixes `dev.<domain>`, SKILL.md rule 2). Omitted for internal workers.
- `assets: { directory, binding: "ASSETS" }` when the entry ships static assets (derived from the `@astrojs/cloudflare` server/client convention).
- Bindings, injected **only for services that declare the matching `needs`**: `d1_databases` (`DB`), `kv_namespaces` (`KV_*`), `r2_buckets` (`R2_*`), `queues.producers` (`QUEUE_*`), `hyperdrive` (`HYPERDRIVE`, when `[services.planetscale]` + `needs = ["planetscale"]`), and `services` (worker-to-worker service bindings — see below). Empty keys are omitted so the config stays minimal.
- `observability: { enabled: <service.observability> }` — **always emitted**, defaulting `true` (Workers Logs on by default; `observability = false` per service opts out).
- `triggers.crons` — see Cron triggers below.

### Vars vs secrets — `domain/cloudflare/workers/worker-vars.ts`

`buildWorkerVars` composes each Worker's public `vars` from just two sources (least-privilege):

1. Backing-service env **filtered by `needs`** (`backingForNeeds`) — a Worker sees only the ids/names/URLs of the backing resources it binds (D1/KV/Queue ids, R2 bucket names + CDN URLs, endpoint). PlanetScale projects **no** var — the `HYPERDRIVE` binding, not a string, reaches Postgres.
2. `SITE_URL = computeSiteUrl(project.domain, env)` — always authoritative, single source (rule 3).

**No cross-service `<NAME>_URL` block** on this target (unlike the VPS): worker-to-worker addressing is a service binding (`env.<NAME>`, a `Fetcher`), never a URL. `buildWorkerVars` documents this explicitly.

Secrets never travel in `vars`. They are pushed via `wrangler secret bulk --config <path>` reading a `name → value` JSON object **from STDIN** (never argv, never a file). The pool = the GLOBAL `[deploy].secrets` ∪ each service's own `secrets`, resolved from `ALL_SECRETS` upstream, then projected per service by `buildServiceSecretEnv` (SKILL.md rules 24, 25). An empty pool skips the bulk call entirely.

### Cron triggers

`[[deploy.cron]]` maps to **native Workers cron triggers** — no BusyBox sidecar (the VPS realization). Only `schedule` and `service` reach the config: jobs whose `service` (default = primary) matches become that service's `triggers.crons`, handled by a workerd `scheduled` handler. `path`/`method` are Hetzner cron-sidecar metadata and are NOT used on this target.

### D1 migrations — `adapters/wrangler/migrate.ts`

Run **between provision and deploy**, never at app startup (SKILL.md rule 8):

```
wrangler d1 migrations apply <project>-<env>-d1 --remote --config <path>
```

The `--remote` flag targets the provisioned database (not a local one). The owning service is the first declaring `needs = ["d1"]`. Gated by `detect-migration-changes` (reused verbatim, reading `[services.d1].migrations_folder`): a push that did not touch the migrations folder skips the whole migrate job; an undiffable range fails safe and runs.

### SEO guard — `adapters/cloudflare/workers/seo-guard-assets.ts`

Injected at deploy time into **each service's static-assets directory**, right before that service's assets upload, for **non-production only** (`injectSeoGuardAssets` + `computeSeoGuardFiles`). Two files:

- `_headers` — `/*` → `X-Robots-Tag: noindex, nofollow, noarchive`
- `robots.txt` — `User-agent: *` / `Disallow: /`

Called per asset-shipping worker so every one is guarded. **Caveat**: on Workers, `_headers` governs only the **static-asset** responses (the files uploaded via the `assets` binding), NOT the SSR responses the Worker itself returns. `robots.txt` (served as a static asset) covers crawler behaviour at the origin, which is the portable guard against indexing a non-prod deploy.

### Smoke check — `domain/cloudflare/workers/smoke-check.ts`

After deploy, a `GET /healthz` (`HEALTHZ_PATH`) hits every **routed** service (`computeSiteUrl(url, env) + /healthz`; internal workers skipped), retried up to `SMOKE_CHECK_MAX_ATTEMPTS = 40` times / `SMOKE_CHECK_RETRY_DELAY_MS = 15_000` (15 s) apart — a ~10 min budget widened to absorb cold Custom-Domain cert propagation on a first deploy. A service still non-2xx once attempts are exhausted throws — the deploy job turns red with the failure in the log.

### wrangler binary

Invoked via `npx --yes wrangler ...` — resolves the deployed app project's local `wrangler` devDependency first, falling back to a one-off download. `wrangler` is NOT a dependency of `@nextnode-solutions/infrastructure`. Auth (`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`) is read ambiently from the forwarded process env, never from argv.

## Worker binding types — `generate-worker-types`

Writes a `worker-configuration.d.ts` per Worker so the app's `import { env } from 'cloudflare:workers'` is typed, replacing hand-written `env.d.ts` shims. Workers-only (no-op on other targets), and runs at **typecheck/build time, never at deploy** — the app's `astro check`/`astro build` must already see `interface Env`.

- **What/where** (`adapters/cloudflare/workers/write-worker-types.ts`): for each `[deploy.services.<name>]`, `renderWorkerEnvTypes` → `writeWorkerTypes` writes `worker-configuration.d.ts` (`TYPES_FILENAME`) into the **app package root** — `resolvePackageDir` walks up from the worker's `entry` to the nearest ancestor with a `package.json` (lands on `apps/<app>` in a monorepo). The consumer tsconfig's `include: **/*` picks it up.
- **Single source of truth** (`domain/cloudflare/workers/worker-env-types.ts`): types are rendered from the **SAME `WranglerDocument`** `buildWranglerConfig` deploys, fed placeholder provision outputs (types need only binding NAMES, not ids). So a binding can never be typed-but-not-deployed or vice versa. Mapping: `assets` + sibling service bindings → `Fetcher`; `d1_databases` → `D1Database`; `kv_namespaces` → `KVNamespace`; `r2_buckets` → `R2Bucket`; `queues.producers` → `Queue`; Hyperdrive → its CF type; public `vars` + `secrets` → `string`. `@cloudflare/workers-types` supplies the globals (`/// <reference types="@cloudflare/workers-types" />`).
- **Committed + drift-guarded**: unlike the deploy-only wrangler config, this file is **committed in the consumer repo** (types are needed at typecheck locally and in every CI job, with no infra dependency at build). The `deploy-workers.yml` plan job regenerates it and runs `git add --intent-to-add` + `git diff --exit-code -- '**/worker-configuration.d.ts'` — `--intent-to-add` makes a missing (never-committed) file fail like a stale one, keeping `nextnode.toml` authoritative.

## Teardown

`teardown` deletes **every Worker script via wrangler FIRST, then `terraform destroy`** (`WORKERS_TEARDOWN_RESOURCES = ['workers', 'terraform']`):

- `wrangler delete --name <project>-<env>-<service> --force` per service (`--force` skips the interactive + Durable-Objects prompts; a `script_not_found` / `[code: 10007]` maps to already-gone).
- `terraform destroy` removes D1/KV/Queues/R2 + Redirect Rules, and the PlanetScale `hyperdrive` role + Hyperdrive config.

A `teardown-guard` runs first and compares `TEARDOWN_CONFIRM` against `[project].name`. **`TEARDOWN_WIPE_DATA` is required** when the project declares D1 or R2 — `assertWipeDataAllowed` otherwise throws `teardown would destroy <D1/R2> data for "<project>" - re-run with wipe_data (TEARDOWN_WIPE_DATA=1) to confirm the irreversible deletion`. The **HCP workspace and the PlanetScale database are never deleted** — the Terraform state stays historised and the DB (`<project>-<env>-planetscale`, created out-of-band by the API adapter) survives. After teardown: zone intact, other pipelines' records intact.

`recover` is a documented **no-op** on this target: `recover is a no-op on <target> for "<project>": the Terraform state is the source of truth, so there is nothing to reconcile.` (The VPS `recover` rebuilds state from Hetzner labels; here the state IS the truth.)

## Plan diff on PRs — `plan-infra`

`plan-infra` (CLI, workers-only) runs `terraform init` + `terraform plan` (`-detailed-exitcode`) and reports the create/update/delete diff. When `PIPELINE_PR_NUMBER` is set it posts the plan as a PR comment (needs `GH_TOKEN` + `pull-requests: write`); otherwise it writes to the step summary only. The plan is env-specific (workspace `<project>-<env>`).

## Reusable workflows

Three workflows in `NextNodeSolutions/core/.github/workflows/`. Full DAG in [pipeline.md](pipeline.md).

### `deploy-workers.yml` (`workflow_call`)

Inputs `environment` (required), `config_file` (default `nextnode.toml`), `dev_workflow_file` (default `deploy-dev.yml`). Jobs:

```
plan --+-- quality (matrix; prod-gate folded in when producing prod)
       |
       +-- provision (needs plan + quality)
       |
       +-- detect-migrations (needs plan; if has_d1)
       |
       +-- migrate (needs plan + provision + detect-migrations; if has_d1 && migrations_changed)
       |
       \-- deploy (needs plan + quality + provision + migrate)
```

- **No `build-image` job, no standalone `dns` job** — there is no Docker build, and DNS is absorbed into `provision`.
- **No separate `prod-gate` job and no separate `seo-guard` step** — the prod gate lives inside the `quality` matrix (driven by `has_prod_gate` + `dev_workflow_file`), and the SEO guard is injected inside the `deploy` CLI per service (build + guard + deploy + smoke check are one CLI step).
- The migration-detection job is `detect-migrations` (the CLI subcommand it runs is `detect-migration-changes`).
- `plan` outputs: `quality_matrix`, `project_name`, `has_prod_gate`, `has_domain`, `has_d1`, `package_dir`.
- The `plan` job also **regenerates and verifies the committed worker types**: `generate-worker-types` then `git diff --exit-code -- '**/worker-configuration.d.ts'` (`--intent-to-add` so a missing file fails too), guarding `worker-configuration.d.ts` drift against `nextnode.toml`.
- Terraform is set up per job with `hashicorp/setup-terraform@v3`, `terraform_version: '~> 1.9'`, `terraform_wrapper: false`.

### `teardown-workers.yml` (`workflow_dispatch`)

Parity with `teardown-vps.yml` / `teardown-pages.yml`. Inputs: `repository` (`owner/repo` of the target), `environment` (choice), `confirm` (type the project name → `TEARDOWN_CONFIRM`), `wipe_data` (boolean → `TEARDOWN_WIPE_DATA`), `config_file`. Checks out the target repo (sparse, `config_file` only), runs `teardown-guard` then `teardown`.

### `plan-workers-diff.yml` (`workflow_call`)

Inputs `environment` + `config_file`; permission `pull-requests: write`. The caller triggers it on `nextnode.toml` changes:

```yaml
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

## Caller convention

A repo deploying to this target provides only:

- `apps/<app>/nextnode.toml` with `[deploy] target = "cloudflare-workers"` and one `[deploy.services.<name>]` per Worker.
- Thin caller workflows pointing at `deploy-workers.yml`:

```yaml
# .github/workflows/deploy-dev.yml
on:
    push:
        branches: [main]
jobs:
    pipeline:
        uses: NextNodeSolutions/core/.github/workflows/deploy-workers.yml@main
        with:
            environment: development
        secrets: inherit
```

```yaml
# .github/workflows/deploy-prod.yml
on:
    workflow_dispatch:
jobs:
    pipeline:
        uses: NextNodeSolutions/core/.github/workflows/deploy-workers.yml@main
        with:
            environment: production
        secrets: inherit
```

**No `Dockerfile`, no committed `wrangler.json`/`wrangler.toml`** — the infra generates the wrangler config per service at deploy. `secrets: inherit` is MANDATORY (`deploy-workers.yml` reads `secrets.*` directly; the caller passes them through). The app builds to the Worker convention: `@astrojs/cloudflare` adapter, `dist/server/entry.mjs` + `dist/client`, a `/healthz` route for the smoke check.

## CLI env vars

Passed by the workflows to `node src/index.ts <command>` (working dir `.infra/packages/infrastructure`). No Hetzner/SSH/Tailscale variables anywhere on this target.

| Var | Used by | Description |
|-----|---------|-------------|
| `PIPELINE_CONFIG_FILE` | all | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | all except `detect-migration-changes` | `development` / `production` |
| `PIPELINE_BASE_SHA` | `detect-migration-changes` | `github.event.before` — the base of the migrations diff |
| `PIPELINE_PR_NUMBER` | `plan-infra` | PR to comment the Terraform diff on |
| `CLOUDFLARE_API_TOKEN` | provision, migrate, deploy, teardown, plan-infra | Cloudflare API token (wrangler + provider auth) |
| `CLOUDFLARE_ACCOUNT_ID` | provision, migrate, deploy, teardown, plan-infra | Cloudflare account id |
| `TF_TOKEN_app_terraform_io` | provision, migrate, deploy, teardown, plan-infra | HCP Terraform token (sourced from the `TF_API_TOKEN` org secret) — read natively by Terraform |
| `PLANETSCALE_SERVICE_TOKEN_ID` / `PLANETSCALE_SERVICE_TOKEN` | provision, teardown (only when `[services.planetscale]` declared) | PlanetScale service-token id + secret for the create-if-absent DB API and the Terraform PlanetScale provider. Required only when the service is declared. |
| `ALL_SECRETS` | provision, migrate, deploy | `toJSON(secrets)` — the resolved secret pool, projected per service |
| `GH_TOKEN` | provision (env-secret push), plan-infra (PR comment) | GitHub App / job token |
| `TEARDOWN_CONFIRM` | teardown-guard | Must equal `[project].name` |
| `TEARDOWN_TARGET` | teardown | `project` (default) |
| `TEARDOWN_WIPE_DATA` | teardown | Required when D1 or R2 is declared, or the teardown refuses |

## Org bootstrap — one-shot (US-0.x)

Provisioning depends on org-level setup done ONCE; afterwards there is zero per-project setup.

- **HCP Terraform org `nextnode`, state-only.** Workspaces are created with execution mode `local` (the CI runner executes the binary; HCP stores only state). Naming convention: workspace = `<project>-<env>`. A team token (not personal) with workspace + state management scope backs it.
- **Org secret `TF_API_TOKEN`.** The HCP state backend token is a cross-project credential → an **org** secret (SKILL.md rule 10), consumed by the workflows as `TF_TOKEN_app_terraform_io`. See [github-org.md](github-org.md) — never hardcode the value.
- **Audit the `CLOUDFLARE_API_TOKEN` scopes.** This target exercises Workers Scripts, D1, KV, Queues, R2, Hyperdrive, Zone DNS, and Zone Rulesets — extend the existing org token if any scope is missing. Verify with `gh secret list --org NextNodeSolutions`.
- **Org secrets `PLANETSCALE_SERVICE_TOKEN_ID` + `PLANETSCALE_SERVICE_TOKEN`** (only if any project uses `[services.planetscale]`). A PlanetScale service token (org `nextnode`) is a cross-project credential → **org** secrets (SKILL.md rule 10), scoped to create databases + manage branch roles. Absent them, a planetscale-declaring provision fails loud.
- **CI tooling pins.** `terraform` is pinned `~> 1.9` via `hashicorp/setup-terraform@v3` (centralized in the workflows). `wrangler` is provided as the app project's devDependency (invoked through `npx --yes`).
