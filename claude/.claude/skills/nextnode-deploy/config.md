# Config Schema Reference

## Full nextnode.toml

```toml
[project]
name = "my-app"                              # Required -- string
type = "app"                                 # Required -- "app" | "package" | "static"
filter = "@nextnode-solutions/logger"        # Optional -- string | false (default: false)
domain = "example.com"                       # Optional -- string (primary domain)
redirect_domains = ["example.fr"]            # Optional -- string[] (static prod only)
internal = false                             # Optional -- boolean (default: false, Hetzner only)

[scripts]
lint = "lint"                                # Optional -- string | false (default: "lint")
test = "test"                                # Optional -- string | false (default: "test")
build = "build"                              # Optional -- string | false (default: "build")

[package]
access = "public"                            # Required if section present -- string

[environment]
development = true                           # Optional -- boolean (default: true)

[deploy]
target = "hetzner-vps"                       # Optional -- inferred from type (app->hetzner-vps, static->cloudflare-pages)
secrets = [                                  # Optional -- GLOBAL pool, see [deploy] field table
  "PREVIEW_SECRET",
  { name = "JWT_SECRET",  generate = "token",    length = 43 },
  { name = "DB_PASSWORD", generate = "password", length = 24 },
]
vps = "monitoring"                           # Optional -- override shared VPS hostname per env (Hetzner only). null = shared default.

[deploy.hetzner]                             # Required when target is "hetzner-vps"
server_type = "cx23"                         # Optional -- Hetzner server type (default: "cx23"). NOTE: cx22 was deprecated, use cx23.
location = "nbg1"                            # Optional -- Hetzner datacenter location (default: "nbg1")

[deploy.volumes]                             # Optional (Hetzner only) -- Docker named volumes mounted into the primary service
data = "/var/lib/app"                        # alias = absolute mount path. Alias is a kebab identifier.

[deploy.services.web]                        # Required (Hetzner only), at least one; N accepted -- see field tables + cross-service rules
source = "build"                             # Optional -- "build" (default) | "upstream"
port = 3000                                  # Optional -- container port (default 3000), see field table
url = "example.com"                          # Optional -- hostname for external routing, see field table
secrets = ["RESEND_API_KEY"]                 # Optional -- per-service RUNTIME secret NAMES, see field table
needs = []                                   # Optional -- backing services (e.g. ["postgres"]), see field table
depends_on = []                              # Optional -- sibling start order (compose depends_on), see field table
# build-only fields:
context = "."                                # Optional, build only -- bake context directory (default ".", the repo root)
dockerfile = "Dockerfile"                    # Optional, build only -- Dockerfile path relative to context (default: <packageDir>/Dockerfile)
target = "web"                               # Optional, build only -- Dockerfile build stage. Omitted = build the Dockerfile's final stage.
build_args = ["ANALYTICS_ID"]                # Optional, build only -- extra GitHub Variable NAMES, see field table
# upstream-only fields:
# ref = "ghcr.io/some-org/app:v1.2.3"        # Required when source = "upstream"
# registry_auth_secret = "GHCR_READ_TOKEN"   # Optional, upstream only -- see field table

[[deploy.cron]]                              # Optional (Hetzner only) -- scheduled HTTP jobs, table-array, see field table
name = "cleanup"                             # Required -- kebab identifier, unique across jobs
schedule = "0 3 * * *"                       # Required -- standard 5-field cron expression
path = "/api/cron/cleanup"                   # Required -- absolute path; hit on the target service INTERNALLY
method = "POST"                              # Optional -- "GET" | "POST" (default "POST")
service = "web"                              # Optional -- target [deploy.services.<name>] (default: primary/first service)

[[services.r2.buckets]]                      # Optional -- per-project R2 buckets, table-array, see field table
name = "assets"                              # Bucket alias (kebab-case)
cdn  = true                                  # Optional -- public CDN custom domain (default false)

[[services.r2.buckets]]
name = "private-cache"                       # cdn omitted -> private bucket, no public URL.

[services.postgres]                          # Optional -- embedded or external Postgres
mode = "embedded"                            # Required -- "embedded" | "external"
migrations_folder = "drizzle"                # Optional (default: "drizzle")
migrate_command = "pnpm drizzle-kit migrate" # Optional -- shell run inside the ephemeral migrate container on the VPS
check_command = "pnpm drizzle-kit check"     # Optional -- shell run on the GH runner during quality

[services.supabase]                          # Optional -- declarative gate, no fields. Pulls in the full self-hosted stack + R2 backups.

[services.observability]                     # Optional (Hetzner only) -- self-hosted metrics + logs + alerting stack
logs_retention = "30d"                       # Required -- VictoriaLogs retention, positive int + h/d/w/y suffix
metrics_retention_months = 12                # Required -- VictoriaMetrics retention, integer months (1-120)
logs_vhost = "logs.monitoring.nextnode.fr"   # Required -- Caddy tailnet front for log ingestion + LogsQL
metrics_vhost = "metrics.monitoring.nextnode.fr" # Required -- Caddy tailnet front for vmui (ad-hoc PromQL)
```

## TypeScript types

```typescript
interface NextNodeConfig {
  readonly project: ProjectSection
  readonly scripts: ScriptsSection
  readonly package: PackageSection | false
  readonly environment: EnvironmentSection
  readonly deploy: DeploySection | false  // false for packages
  readonly services: ServicesConfig         // {} when no services declared
}

interface ServicesConfig {
  readonly r2?: R2ServiceConfig
  readonly postgres?: PostgresServiceConfig
  readonly supabase?: SupabaseServiceConfig
  readonly observability?: ObservabilityServiceConfig
}

interface R2ServiceConfig {
  readonly buckets: ReadonlyArray<R2BucketConfig>
}

interface R2BucketConfig {
  readonly name: string   // bucket alias (kebab). Materialized as `<project>-<env>-<name>`.
  readonly cdn: boolean    // true -> public custom domain `<name>.cdn.<domain>` + `R2_BUCKET_<NAME>_URL`. Default false (private).
}

interface PostgresServiceConfig {
  readonly mode: "embedded" | "external"
  readonly migrationsFolder?: string
  readonly migrateCommand?: string
  readonly checkCommand?: string
}

// `[services.supabase]` is a declarative gate -- the presence of the table
// opts the project into the full Supabase stack + R2 backups alias. No
// fields today; future knobs land here when there's a decision to expose.
type SupabaseServiceConfig = Readonly<Record<string, never>>

interface ObservabilityServiceConfig {
  readonly logsRetention: string            // "30d" etc. (positive int + h/d/w/y)
  readonly metricsRetentionMonths: number   // integer months, 1-120
  readonly logsVhost: string                // tailnet host Caddy fronts VictoriaLogs
  readonly metricsVhost: string             // tailnet host Caddy fronts VictoriaMetrics/vmui
}

interface ProjectSection {
  readonly name: string
  readonly type: "app" | "package" | "static"
  readonly filter: string | false
  readonly domain: string | undefined
  readonly redirectDomains: ReadonlyArray<string>
  readonly internal: boolean
}

interface ScriptsSection {
  readonly lint: string | false
  readonly test: string | false
  readonly build: string | false
}

interface PackageSection {
  readonly access: string
}

interface EnvironmentSection {
  readonly development: boolean
}

type DeployTargetType = "hetzner-vps" | "cloudflare-pages"
type DeployableProjectType = "app" | "static"

interface DeployVolume {
  readonly name: string   // alias (kebab identifier)
  readonly mount: string  // absolute mount path inside the container
}

// A `[deploy].secrets` entry the infra GENERATES and pushes to GitHub at provision.
const SECRET_GENERATORS = ["token", "password"] as const
type SecretGenerator = (typeof SECRET_GENERATORS)[number]
interface GeneratedSecretConfig {
  readonly name: string
  readonly generate: SecretGenerator  // see [deploy] field table
  readonly length: number
}

interface BaseDeploySection {
  readonly vps: string | null
  readonly volumes: ReadonlyArray<DeployVolume>  // Hetzner only
  readonly generatedSecrets: ReadonlyArray<GeneratedSecretConfig>  // {name,generate,length} tables from [deploy].secrets; consumed by ensureGeneratedSecrets
}

interface HetznerVpsDeploySection extends BaseDeploySection {
  readonly target: "hetzner-vps"
  readonly secrets: ReadonlyArray<string>  // pull pool — see [deploy] field table
  readonly hetzner: HetznerDeployConfig
  readonly services: Readonly<Record<string, UserServiceConfig>>  // keyed by KEBAB instance name, at least one
  readonly cron: ReadonlyArray<CronJobConfig>  // [[deploy.cron]] jobs; [] when none. Hetzner only.
}

const CRON_METHODS = ['GET', 'POST'] as const
type CronMethod = (typeof CRON_METHODS)[number]
const DEFAULT_CRON_METHOD: CronMethod = 'POST'

interface CronJobConfig {
  readonly name: string         // kebab, unique across jobs
  readonly schedule: string     // standard 5-field cron expression
  readonly path: string         // absolute path hit on the target service (http://<service>:<port><path>)
  readonly method: CronMethod   // GET | POST (default POST)
  readonly service?: string     // target [deploy.services.<name>]; omitted = primary (first declared)
}

interface CloudflarePagesDeploySection extends BaseDeploySection {
  readonly target: "cloudflare-pages"
  readonly secrets: ReadonlyArray<string>  // the pool IS [deploy].secrets
}

type DeploySection = HetznerVpsDeploySection | CloudflarePagesDeploySection

interface HetznerDeployConfig {
  readonly serverType: string
  readonly location: string
}

// --- [deploy.services.<name>] ----------------------------------------------

interface ServiceCommon {
  readonly port: number                        // default 3000
  readonly url?: string
  readonly secrets: ReadonlyArray<string>      // RUNTIME secret NAMES, projected into this service's .env only
  readonly needs: ReadonlyArray<string>        // backing services (validated ⊆ [services.*]); opts into their secrets
  readonly dependsOn: ReadonlyArray<string>    // sibling services (compose depends_on)
}

interface BuildServiceConfig {
  readonly source: "build"
  readonly context?: string
  readonly dockerfile?: string
  readonly target?: string                     // omitted = build the Dockerfile's final stage
  readonly buildArgs?: ReadonlyArray<string>   // EXTRA GitHub Variable NAMES → docker-bake build args. SITE_URL auto-injected; secrets banned. Omitted when none.
}

interface UpstreamServiceConfig {
  readonly source: "upstream"
  readonly ref: string                         // full image ref, parsed via parseImageRef
  readonly registryAuthSecret?: string         // repo/org secret NAME (omit for public images)
}

type UserServiceConfig = ServiceCommon & (BuildServiceConfig | UpstreamServiceConfig)

// Narrowed config types - discriminated by target
interface HetznerDeployableConfig extends NextNodeConfig {
  readonly project: ProjectSection & { readonly type: DeployableProjectType; readonly domain: string }
  readonly deploy: HetznerVpsDeploySection
}

interface CloudflarePagesDeployableConfig extends NextNodeConfig {
  readonly project: ProjectSection & { readonly type: DeployableProjectType }
  readonly deploy: CloudflarePagesDeploySection
}

type DeployableConfig = HetznerDeployableConfig | CloudflarePagesDeployableConfig
```

## Fields

### `[project]` (required)

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `name` | `string` | Yes | -- | Project identifier |
| `type` | `"app" \| "package" \| "static"` | Yes | -- | Tells caller which reusable workflow to invoke |
| `filter` | `string \| false` | No | `false` | Turbo `--filter` value for monorepo scoping |
| `domain` | `string` | No | -- | Primary custom domain (used for DNS, Pages domains, SITE_URL) |
| `redirect_domains` | `string[]` | No | `[]` | Additional domains (static prod only -- get DNS CNAMEs + Pages attachment) |
| `internal` | `boolean` | No | `false` | Internal-only VPS (Tailscale network). Controls DNS, firewall, Caddy, UFW. Hetzner only. |

Type mapping (caller picks the workflow):

| `type` | Caller invokes | Deploy target |
| ------ | -------------- | ------------- |
| `package` | `publish-package.yml` | npm (semantic-release) |
| `app` | `deploy.yml` | Hetzner VPS (WIP) |
| `static` | `deploy-static.yml` | Cloudflare Pages |

### `[scripts]` (optional)

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `lint` | `string \| false` | `"lint"` | Lint script name, or `false` |
| `test` | `string \| false` | `"test"` | Test script name, or `false` |
| `build` | `string \| false` | `"build"` | Build script name, or `false` |

Only `lint` and `test` appear in the quality matrix -- `build` only runs in publish/deploy jobs.

### `[package]` (optional)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `access` | `string` | Yes* | npm publish access level |

*Required only when the section is present. Absence of the section means `package = false` (no publish).

### `[environment]` (optional)

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `development` | `boolean` | `true` | When true + `environment=production`: prod-gate task added to quality matrix. When false: direct-to-prod. |

### `[deploy]` (optional for deployable types, forbidden for packages)

Deploy section is only valid for `app` and `static` project types. For `package` type, the presence of `[deploy]` is a validation error.

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `target` | `"hetzner-vps" \| "cloudflare-pages"` | Inferred from type | Deploy target. `app` -> `hetzner-vps`, `static` -> `cloudflare-pages`. Can be overridden explicitly. |
| `secrets` | `(string \| {name,generate,length})[]` | `[]` | **GLOBAL secret pool — both targets.** Each entry is a must-exist GitHub secret NAME (string) or a `{name, generate, length}` auto-generated table. For **hetzner-vps** the names are folded into every service (`expandServiceSecrets`); the pull pool = global ∪ every service's own `secrets`. For **cloudflare-pages** the pool IS this list. Generated entries also populate `deploy.generatedSecrets` (pushed at provision by `ensureGeneratedSecrets`). Generators (`domain/deploy/secret-generation.ts`): `token` → base64url (JWT/HS256 keys; 64 chars maps 1:1 to a byte), `password` → alphanumeric (rejection-sampled — 62 isn't a power of two, avoids modulo bias); `length` is the produced CHARACTER count. Duplicate names / unknown generators / lengths outside 8–256 fail at parse. |
| `vps` | `string \| null` | `null` | Override the VPS hostname this project deploys onto. When `null`, the CLI resolves a shared default per environment (see `resolveVpsName`). Hetzner-only - Cloudflare ignores it. Used for projects that need a dedicated VPS (e.g. `monitoring` runs on its own internal VPS, not the shared one). |
| `image` | n/a | n/a | **REMOVED.** The legacy `[deploy.image]` table was dropped; the validator surfaces `deploy.image is an unknown field — migrate to [deploy.services.<name>]`. |

### `[deploy.hetzner]` (required when target is `hetzner-vps`)

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `server_type` | `string` | No | `"cx23"` | Hetzner Cloud server type (e.g. `cx23`, `cpx22`, `cax11`). NOTE: `cx22` is deprecated - use `cx23`. |
| `location` | `string` | No | `"nbg1"` | Hetzner datacenter location (e.g. `nbg1`, `fsn1`) |

Defaults live in `DEFAULT_HETZNER_CONFIG` (`config/types.ts`). When target is `hetzner-vps`, `project.domain` is also required (used for hostname convention).

### `[deploy.volumes]` (optional, Hetzner only)

Map of alias -> absolute mount path. Each alias is materialized as a Docker named volume on the VPS local SSD and mounted into the PRIMARY service (the first declared `[deploy.services.<name>]`). Alias is a kebab identifier; mount must be an absolute path. Cloudflare Pages ignores the field. See [hetzner-caller.md](hetzner-caller.md) for lifecycle (redeploys preserve, teardown preserves unless `--wipe-backups`).

### `[deploy.services.<name>]` (required when target is `hetzner-vps`, at least one)

Each entry is a deployable workload. The instance name (the table key) is a KEBAB identifier and is used end-to-end: GHCR repo suffix for `build` images (`<owner>/<repo>-<name>`), compose service key, `.env.<name>` per-service env file, host-port allocation slot, bake target, DNS record name, Caddy upstream, migrate-container image lookup. **N entries per project are accepted.** See [multi-service.md](multi-service.md) for the per-service routing rules.

Cross-service validation rules:

- All services MUST share the same `source` (all `build` or all `upstream`). Mixing is rejected.
- Each declared `url` MUST be unique across services AND equal to or a subdomain of `project.domain`.
- When `[services.postgres]` is declared, exactly one service MUST declare `needs = ["postgres"]`.
- All upstream services that declare `registry_auth_secret` MUST reference the SAME secret name (homogeneous registry auth).
- Every `needs` entry MUST reference a declared `[services.<name>]` (`validateServiceNeedsRefs`); every `depends_on` entry MUST reference a declared service.
- The hetzner secret pull pool = the GLOBAL `[deploy].secrets` (folded into every service) UNIONED with every service's own `secrets`.
- `build_args` is allowed only on `source = "build"` services (forbidden on `upstream`).

Common fields:

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `port` | `integer` (1-65535) | No | `3000` | Container port. Injected as `PORT`, drives the compose port mapping (`127.0.0.1:<host>:<port>`) and the `/healthz` probe (build services only). |
| `url` | `string` | No | -- | Hostname for external routing. Must be unique and within `project.domain`. When set, one DNS record + one Caddy upstream + one allocated host port. Absent = internal-only (siblings reach it as `<service-name>:<port>` on the compose network). |
| `secrets` | `string[]` | No | `[]` | Per-service (least-privilege) RUNTIME secret NAMES (values from `ALL_SECRETS`), projected into THIS service's `.env.<name>` ONLY — no broadcast. The GLOBAL `[deploy].secrets` names are folded in on top of this list (`expandServiceSecrets`); the hetzner pull pool is their union. |
| `needs` | `string[]` | No | `[]` | Backing services this workload uses (e.g. `["postgres"]`). MUST reference a declared `[services.<name>]`. Opts the service into that backing service's secrets (e.g. `DATABASE_URL`) — projected only into the services that declare the `needs`. Selects the postgres-owning service when migrations are declared. |
| `depends_on` | `string[]` | No | `[]` | Sibling services this workload starts after (compose `depends_on`). Gating condition follows Y's source: `service_healthy` (build) or `service_started` (upstream). |
| `source` | `"build" \| "upstream"` | No | `"build"` | Image source discriminator. All services in the project MUST share the same source. The validator forbids the build-only knobs under upstream and vice versa. |

`source = "build"` fields:

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `context` | `string` | No | `"."` (repo root) | Bake context directory. |
| `dockerfile` | `string` | No | `<packageDir>/Dockerfile` | Dockerfile path relative to context. |
| `target` | `string` | No | Dockerfile's final stage | Dockerfile build stage (`--target`). Omitted = no `--target`, builds the final stage. |
| `build_args` | `string[]` | No | `[]` | EXTRA GitHub Variable NAMES inlined as docker-bake build args for this target. Values come from `ALL_VARS` (`toJSON(vars)`); `resolveBuildArgs` fails loud if a declared name is absent. `SITE_URL` is auto-injected by the infra and must NOT be listed. **Secrets are banned** — a build arg bakes into image layers / `docker history`. |

`source = "upstream"` fields:

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `ref` | `string` | Yes | Full image ref (`<registry>/<repository>:<tag>`). Parsed through `parseImageRef` at validation time; a malformed ref fails plan, never as a broken `docker pull` on the VPS. |
| `registry_auth_secret` | `string` | No | Repo/org secret NAME holding the registry password. Omit for public images. The VPS SSH session runs `docker login` with this value before pulling. |

### `[[deploy.cron]]` (optional, Hetzner only)

Scheduled HTTP jobs, declared as a **table-array**. Each entry fires a request at one of THIS project's services over the compose network, on a cron schedule. The infra renders all jobs into a single `cron` sidecar (alpine BusyBox `crond` + `wget`) in the compose file — no host port, no Docker socket, no app-image dependency, no external config. Runs in **both dev and prod**: each environment is its own compose stack with its own `cron` sidecar hitting its own app, so the two are isolated by construction (unlike the prod-only postgres backup loop). Forbidden on `cloudflare-pages` (a static site has no always-on runtime). See [cron-service.md](cron-service.md).

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `name` | `string` | Yes | -- | Kebab identifier, unique across jobs. Becomes the crontab line's logical id. |
| `schedule` | `string` | Yes | -- | Standard **5-field** cron expression (`min hour dom month dow`). Each field validated against its real range (minute 0–59, hour 0–23, dom 1–31, month 1–12, dow 0–7) + grammar (`*`, `N`, `N-M`, `*/STEP`, comma-lists). Out-of-range, inverted ranges (`5-1`), `*/0`, bare operators, and `@daily`-style macros fail loud at parse rather than silently never firing on the VPS. |
| `path` | `string` | Yes | -- | Absolute request path (`/...`). Hit INTERNALLY as `http://<service>:<port><path>` — the dev never spells a host, because the public URL is infra-generated. **Single-quoted** into the wget command; cannot contain whitespace or quote characters (a query string like `?a=1&b=2` is safe, the quoting makes `&` inert). |
| `method` | `"GET" \| "POST"` | No | `"POST"` | HTTP method. POST is the default (a cron usually TRIGGERS work; GET risks prefetch/cache). Kept to what BusyBox `wget` implements. |
| `service` | `string` | No | primary service | Which `[deploy.services.<name>]` to hit. Must reference a declared service. Omitted = the primary (first declared) service. The name `cron` is **reserved** for the sidecar — a `[deploy.services.cron]` is rejected at parse. |

The endpoint is the app's responsibility to make idempotent and (if needed) protect — the same `/api/...` route is also reachable publicly via Caddy.

### `[services.r2]` (optional)

Per-project R2 (Cloudflare Object Storage) buckets, declared as a **table-array** (`[[services.r2.buckets]]`). The infra provisions one Cloudflare R2 bucket per declared alias, scoped per environment, plus a single API token (read+write) on every declared bucket. Each bucket opts into a public CDN custom domain with `cdn = true`. The runtime app reaches buckets by alias via env vars.

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `name` | `string` | Yes | -- | Bucket alias (kebab-case). Materialized as `<projectName>-<environment>-<alias>` and exposed as `R2_BUCKET_<ALIAS>`. |
| `cdn` | `boolean` | No | `false` | When `true`, provision attaches a public Cloudflare custom domain `<alias>.cdn.<resolveDeployDomain(domain)>` to the bucket and exposes `R2_BUCKET_<ALIAS>_URL`. `false` = private (no public URL). Requires `project.domain`. |

Injected into the deployed runtime as:
- `R2_ENDPOINT` (public)
- `R2_BUCKET_<ALIAS>` per alias (public)
- `R2_BUCKET_<ALIAS>_URL` per `cdn = true` alias (public — the `https://` CDN URL)
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (secret - routed via `DeployInput.secrets`, never `writeEnvVar`)

See [r2-service.md](r2-service.md) for the full provisioning + runtime contract.

### `[services.observability]` (optional, Hetzner only)

Self-hosted metrics + logs + alerting stack, injected as compose sidecars on the monitoring VPS. Contributes no app env; provisions nothing external (volumes stay local). Secrets (`RESEND_API_KEY`, `HEALTHCHECKS_PING_URL`) flow through `[deploy].secrets` and are optional.

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `logs_retention` | `string` | Yes | -- | VictoriaLogs `-retentionPeriod`: a positive integer + single unit suffix `h`/`d`/`w`/`y` (e.g. `"30d"`). |
| `metrics_retention_months` | `number` | Yes | -- | VictoriaMetrics retention in whole months, integer `1`–`120`. |
| `logs_vhost` | `string` | Yes | -- | Tailnet hostname Caddy fronts VictoriaLogs (ingestion + LogsQL) with. Internal, never public. |
| `metrics_vhost` | `string` | Yes | -- | Tailnet hostname Caddy fronts VictoriaMetrics/vmui (ad-hoc PromQL) with. Internal, never public. |

See [observability-service.md](observability-service.md) for the stack topology, golden-image exporters, and service discovery.

## CLI env vars

### Hetzner commands (`provision`, `dns`, `deploy`)

| Var | Required by | Description |
| --- | ----------- | ----------- |
| `PIPELINE_CONFIG_FILE` | all | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | all | `"development"` or `"production"` (`plan` for non-package only) |
| `HETZNER_API_TOKEN` | all | Hetzner Cloud API token (Full access) |
| `DEPLOY_SSH_PRIVATE_KEY_B64` | all | Base64-encoded SSH private key for deploy user |
| `CLOUDFLARE_API_TOKEN` | all | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | all | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | all | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | all | R2 S3-compatible secret key |
| `TAILSCALE_AUTH_KEY` | provision | Tailscale OAuth secret for VPS join |
| `GH_TOKEN` | provision | GitHub App token (for org secret persistence) |
| `IMAGE_REFS` | deploy, migrate-remote | JSON Record `{<service>: {registry, repository, tag}}` -- consumed by `parseImageRefsEnv`. Built path: emitted by `compute-image-ref`. Upstream path: emitted by `plan` as `upstream_image_refs`. Replaces the legacy single-string `IMAGE_REF`. |
| `GHCR_TOKEN` | deploy (build services only) | GitHub token for GHCR pull on VPS. The `registryAuthSecret` value is used instead for upstream services. |
| `ALL_SECRETS` | deploy, migrate-remote (when the resolved secret pool is non-empty), provision (read by `ensureGeneratedSecrets` to skip already-present generated secrets) | `toJSON(secrets)` from GitHub Actions. Parsed by `readJsonRecordEnv` (shared with `ALL_VARS`), then projected per-service by `buildServiceSecretEnv`. |

### Cloudflare Pages commands (`provision`, `dns`, `deploy`)

Subset of above: `PIPELINE_CONFIG_FILE`, `PIPELINE_ENVIRONMENT`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `ALL_SECRETS` (deploy, when `deploy.secrets` non-empty).

### `plan` command

`PIPELINE_CONFIG_FILE` (required) + `PIPELINE_ENVIRONMENT` (required for non-package).

### `compute-image-ref` command

Requires a `hetzner-vps` target (non-container targets build no images).

| Var | Required | Description |
| --- | -------- | ----------- |
| `GITHUB_REPOSITORY` | Yes | `owner/repo` |
| `GITHUB_SHA` | Yes | Commit SHA |
| `PACKAGE_DIR` | Yes | Package directory relative to the repo root — defaults the bake target's Dockerfile path (`<packageDir>/Dockerfile`) |
| `GITHUB_WORKSPACE` | Yes | Workspace root — where `docker-bake.json` is written (the bake-action runs with `source: .`) |
| `PIPELINE_ENVIRONMENT` | For app | `"development"` or `"production"` — env-resolves the auto-injected `SITE_URL` build arg |
| `ALL_VARS` | No | `toJSON(vars)` (repo/org GitHub Variables). Source for each service's declared `build_args`. Absent/empty → `{}`; a declared `build_args` name absent from it fails loud. |

### `seo-guard` command

| Var | Required | Description |
| --- | -------- | ----------- |
| `PIPELINE_CONFIG_FILE` | Yes | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | Yes | `"development"` or `"production"` |
| `BUILD_DIRECTORY` | For non-prod | Absolute path to build output directory |

### `prod-gate` command

| Var | Required | Description |
| --- | -------- | ----------- |
| `GITHUB_REPOSITORY` | Yes | `owner/repo` |
| `GITHUB_SHA` | Yes | Commit SHA to check |
| `GH_TOKEN` | Yes | GitHub token with `actions:read` |
| `DEV_WORKFLOW_FILE` | No | Dev workflow filename (default: `deploy-dev.yml`) |

### `publish-result` command

| Var | Required | Description |
| --- | -------- | ----------- |
| `SR_OUTPUT_FILE` | Yes | Path to semantic-release output file |

## Plan outputs

Written to `GITHUB_OUTPUT` by `writePlanOutputs()`:

| Key | Source | Used by |
| --- | ------ | ------- |
| `quality_matrix` | `buildQualityMatrix()` | quality job matrix |
| `project_name` | `computePagesProjectName()` | deploy + provision jobs |
| `project_type` | `config.project.type` | informational |
| `project_filter` | `config.project.filter` | publish job |
| `publish` | `config.package ? true : false` | publish gate |
| `development_enabled` | `config.environment.development` | informational |
| `has_prod_gate` | `hasProdGate(quality_matrix)` | quality job `infra:` input |
| `has_domain` | `Boolean(config.project.domain)` | conditional dns job |
| `has_postgres` | `Boolean(config.services.postgres)` | gates the `migrate` job on `deploy.yml` |
| `domain` | `config.project.domain ?? ''` | downstream jobs needing the domain string |
| `build_directory` | computed from config file path | SEO guard + wrangler deploy |
| `package_dir` | path of `nextnode.toml`'s directory | downstream jobs (working-directory) |
| `image_source` | `"build"` / `"upstream"` / `""` (non-Hetzner or non-deployable) | routes past `build-image` in `deploy.yml` |
| `upstream_image_refs` | JSON Record (`{<service>: {registry, repository, tag}}`) for upstream, empty string for build | fed as `IMAGE_REFS` to the deploy + migrate jobs when `image_source == "upstream"`. Same JSON shape as `compute-image-ref`'s `image_refs` so `parseImageRefsEnv` consumes both paths identically. |
