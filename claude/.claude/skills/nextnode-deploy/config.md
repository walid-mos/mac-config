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
secrets = ["RESEND_API_KEY", "SUPABASE_URL"] # Optional -- string[]
vps = "monitoring"                           # Optional -- override shared VPS hostname per env (Hetzner only). null = shared default.

[deploy.hetzner]                             # Required when target is "hetzner-vps"
server_type = "cx23"                         # Optional -- Hetzner server type (default: "cx23"). NOTE: cx22 was deprecated, use cx23.
location = "nbg1"                            # Optional -- Hetzner datacenter location (default: "nbg1")

[services.r2]                                # Optional -- per-project R2 buckets (Cloudflare R2)
buckets = ["uploads", "thumbnails"]          # Bucket aliases (kebab-case). Materialized as `<projectName>-<environment>-<alias>`.
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
}

interface R2ServiceConfig {
  readonly buckets: ReadonlyArray<string>
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

interface BaseDeploySection {
  readonly secrets: ReadonlyArray<string>
  readonly vps: string | null  // Override shared VPS hostname per env. null = shared default. Cloudflare ignores this.
}

interface HetznerVpsDeploySection extends BaseDeploySection {
  readonly target: "hetzner-vps"
  readonly hetzner: HetznerDeployConfig
}

interface CloudflarePagesDeploySection extends BaseDeploySection {
  readonly target: "cloudflare-pages"
}

type DeploySection = HetznerVpsDeploySection | CloudflarePagesDeploySection

interface HetznerDeployConfig {
  readonly serverType: string
  readonly location: string
}

// Narrowed config types — discriminated by target
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
| `secrets` | `string[]` | `[]` | Secret names picked from GitHub Secrets at deploy time. |
| `vps` | `string \| null` | `null` | Override the VPS hostname this project deploys onto. When `null`, the CLI resolves a shared default per environment (see `resolveVpsName`). Hetzner-only — Cloudflare ignores it. Used for projects that need a dedicated VPS (e.g. `monitoring` runs on its own internal VPS, not the shared one). |

### `[deploy.hetzner]` (required when target is `hetzner-vps`)

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `server_type` | `string` | No | `"cx23"` | Hetzner Cloud server type (e.g. `cx23`, `cpx22`, `cax11`). NOTE: `cx22` is deprecated — use `cx23`. |
| `location` | `string` | No | `"nbg1"` | Hetzner datacenter location (e.g. `nbg1`, `fsn1`) |

Defaults live in `DEFAULT_HETZNER_CONFIG` (`config/types.ts`). When target is `hetzner-vps`, `project.domain` is also required (used for hostname convention).

### `[services.r2]` (optional)

Per-project R2 (Cloudflare Object Storage) buckets. The infra provisions one Cloudflare R2 bucket per declared alias, scoped per environment, plus a single API token (read+write) on every declared bucket. The runtime app reaches buckets by alias via env vars.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `buckets` | `string[]` | Yes | Bucket aliases (kebab-case). Each alias is materialized as `<projectName>-<environment>-<alias>` and exposed as `R2_BUCKET_<ALIAS>` env var. |

Injected into the deployed runtime as:
- `R2_ENDPOINT` (public)
- `R2_BUCKET_<ALIAS>` per alias (public)
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (secret — routed via `DeployInput.secrets`, never `writeEnvVar`)

See [r2-service.md](r2-service.md) for the full provisioning + runtime contract.

## CLI env vars

### `plan` command

| Var | Required | Description |
| --- | -------- | ----------- |
| `PIPELINE_CONFIG_FILE` | Yes | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | For non-package | `"development"` or `"production"` |

### `provision` command (Hetzner)

| Var | Required | Description |
| --- | -------- | ----------- |
| `PIPELINE_CONFIG_FILE` | Yes | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | Yes | `"development"` or `"production"` |
| `HETZNER_API_TOKEN` | Yes | Hetzner Cloud API token (Full access) |
| `DEPLOY_SSH_PRIVATE_KEY_B64` | Yes | Base64-encoded SSH private key for deploy user |
| `TAILSCALE_AUTH_KEY` | Yes | Tailscale OAuth secret for VPS join |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 S3-compatible secret key |
| `GH_TOKEN` | Yes | GitHub App token (for org secret persistence) |

### `dns` command (Hetzner)

| Var | Required | Description |
| --- | -------- | ----------- |
| `PIPELINE_CONFIG_FILE` | Yes | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | Yes | `"development"` or `"production"` |
| `HETZNER_API_TOKEN` | Yes | Hetzner Cloud API token |
| `DEPLOY_SSH_PRIVATE_KEY_B64` | Yes | Base64-encoded SSH private key |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 S3-compatible secret key |

### `deploy` command (Hetzner)

| Var | Required | Description |
| --- | -------- | ----------- |
| `PIPELINE_CONFIG_FILE` | Yes | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | Yes | `"development"` or `"production"` |
| `HETZNER_API_TOKEN` | Yes | Hetzner Cloud API token |
| `DEPLOY_SSH_PRIVATE_KEY_B64` | Yes | Base64-encoded SSH private key |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 S3-compatible secret key |
| `IMAGE_REF` | Yes | Full GHCR image ref from build-image job |
| `GHCR_TOKEN` | Yes | GitHub token for GHCR pull on VPS |
| `ALL_SECRETS` | When deploy.secrets non-empty | `toJSON(secrets)` from GitHub Actions |

### `provision`, `deploy`, `dns` commands (Cloudflare Pages)

| Var | Required | Description |
| --- | -------- | ----------- |
| `PIPELINE_CONFIG_FILE` | Yes | Path to `nextnode.toml` |
| `PIPELINE_ENVIRONMENT` | For non-package | `"development"` or `"production"` |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `ALL_SECRETS` | When deploy.secrets non-empty | `toJSON(secrets)` from GitHub Actions |

### `compute-image-ref` command

| Var | Required | Description |
| --- | -------- | ----------- |
| `GITHUB_REPOSITORY` | Yes | `owner/repo` |
| `GITHUB_SHA` | Yes | Commit SHA |

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
| `build_directory` | computed from config file path | SEO guard + wrangler deploy |
