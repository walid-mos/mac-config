# Config Schema Reference

## Full nextnode.toml

```toml
[project]
name = "my-app"                              # Required — string
type = "app"                                 # Required — "app" | "package" | "static"
filter = "@nextnode-solutions/logger"        # Optional — string | false (default: false)

[scripts]
lint = "lint"                                # Optional — string | false (default: "lint")
test = "test"                                # Optional — string | false (default: "test")
build = "build"                              # Optional — string | false (default: "build")

[package]
access = "public"                            # Required if section present — string

[environment]
development = true                           # Optional — boolean (default: true)
```

## TypeScript types

```typescript
interface NextNodeConfig {
  readonly project: ProjectSection
  readonly scripts: ScriptsSection
  readonly package: PackageSection | false
  readonly environment: EnvironmentSection
}

interface ProjectSection {
  readonly name: string
  readonly type: "app" | "package" | "static"
  readonly filter: string | false
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
```

## Fields

### `[project]` (required)

| Field    | Type                            | Required | Default | Description                                |
| -------- | ------------------------------- | -------- | ------- | ------------------------------------------ |
| `name`   | `string`                        | Yes      | —       | Project identifier                         |
| `type`   | `"app" \| "package" \| "static"`| Yes      | —       | Tells caller which reusable workflow to invoke |
| `filter` | `string \| false`               | No       | `false` | Turbo `--filter` value for monorepo scoping |

Type mapping (caller picks the workflow):

| `type`    | Caller invokes                | Deploy target            |
| --------- | ----------------------------- | ------------------------ |
| `package` | `publish-package.yml`         | npm (semantic-release)   |
| `app`     | `deploy.yml`                  | Hetzner (future)         |
| `static`  | `deploy-static.yml`           | Cloudflare Pages         |

### `[scripts]` (optional)

| Field   | Type              | Default   | Description                     |
| ------- | ----------------- | --------- | ------------------------------- |
| `lint`  | `string \| false` | `"lint"`  | Lint script name, or `false`   |
| `test`  | `string \| false` | `"test"`  | Test script name, or `false`   |
| `build` | `string \| false` | `"build"` | Build script name, or `false`  |

Only `lint` and `test` appear in the quality matrix — `build` is only used in the publish job.

### `[package]` (optional)

| Field    | Type     | Required | Description                |
| -------- | -------- | -------- | -------------------------- |
| `access` | `string` | Yes*     | npm publish access level   |

*Required only when the section is present. Absence of the section means `package = false` (no publish).

### `[environment]` (optional)

| Field         | Type      | Default | Description                                    |
| ------------- | --------- | ------- | ---------------------------------------------- |
| `development` | `boolean` | `true`  | When true + `environment=production`: prod-gate task added to quality matrix (checks dev workflow passed). When false: direct-to-prod, no gate. |

## CLI env vars

`plan` command (run via `tsx src/index.ts`):

| Var                    | Required        | Description                                   |
| ---------------------- | --------------- | --------------------------------------------- |
| `PIPELINE_CONFIG_FILE` | Yes             | Path to `nextnode.toml`                       |
| `PIPELINE_ENVIRONMENT` | For non-package | `"development"` or `"production"` — drives prod-gate injection. Not required (and ignored) when `type=package` — resolved to internal `'none'` |

## Plan outputs

Written to `GITHUB_OUTPUT` by `writePlanOutputs()`:

| Key                   | Source                              | Used by              |
| --------------------- | ----------------------------------- | -------------------- |
| `quality_matrix`      | `buildQualityMatrix()`              | quality job matrix   |
| `project_name`        | `config.project.name`               | post-quality jobs    |
| `project_type`        | `config.project.type`               | informational        |
| `project_filter`      | `config.project.filter`             | publish job          |
| `publish`             | `config.package ? true : false`     | publish gate         |
| `development_enabled` | `config.environment.development`    | informational        |
| `has_prod_gate`       | `hasProdGate(quality_matrix)`       | quality job `infra:` input (conditional infra checkout) |
