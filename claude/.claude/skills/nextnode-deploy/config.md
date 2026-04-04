# Config Schema Reference

## Full nextnode.toml

```toml
[project]
name = "my-app"                              # Required — string
type = "app"                                 # Required — "app" | "package"
filter = "@nextnode-solutions/logger"        # Optional — string | false (default: false)

[scripts]
lint = "lint"                                # Optional — string | false (default: "lint")
test = "test"                                # Optional — string | false (default: "test")
build = "build"                              # Optional — string | false (default: "build")
```

## TypeScript types

```typescript
interface NextNodeConfig {
  readonly project: ProjectSection;
  readonly scripts: ScriptsSection;
}

interface ProjectSection {
  readonly name: string;
  readonly type: "app" | "package";
  readonly filter: string | false;
}

interface ScriptsSection {
  readonly lint: string | false;
  readonly test: string | false;
  readonly build: string | false;
}
```

## Fields

### `[project]` (required)

| Field    | Type                    | Required | Default | Description                                |
| -------- | ----------------------- | -------- | ------- | ------------------------------------------ |
| `name`   | `string`                | Yes      | —       | Project identifier                         |
| `type`   | `"app" \| "package"`    | Yes      | —       | Routes post-quality jobs (deploy/publish)  |
| `filter` | `string \| false`       | No       | `false` | Turbo `--filter` value for monorepo scoping |

### `[scripts]` (optional)

| Field   | Type              | Default   | Description                     |
| ------- | ----------------- | --------- | ------------------------------- |
| `lint`  | `string \| false` | `"lint"`  | Lint script name, or `false`   |
| `test`  | `string \| false` | `"test"`  | Test script name, or `false`   |
| `build` | `string \| false` | `"build"` | Build script name, or `false`  |

Set a script to `false` to disable it. Only `lint` and `test` appear in the quality matrix — `build` is never run in quality gates.

## Validation

`parseConfig(raw)` returns a discriminated union:

```typescript
type ParseConfigResult =
  | { ok: true; config: NextNodeConfig }
  | { ok: false; errors: readonly string[] };
```

All errors are collected and returned at once — validation does not short-circuit on the first error.

## Filter behavior

When `filter` is set to a string:
- Quality commands: `pnpm turbo run {task} --filter={filter}`
- Scopes turbo to the target package in a monorepo

When `filter` is `false` (default):
- Quality commands: `pnpm {task}`
- Runs scripts from the project root as-is

## Examples

### Standalone app

```toml
[project]
name = "my-saas"
type = "app"
```

### Library package

```toml
[project]
name = "my-lib"
type = "package"

[scripts]
build = "build:lib"
```

### Monorepo package with turbo filter

```toml
[project]
name = "logger"
type = "package"
filter = "@nextnode-solutions/logger"
```

### Minimal (disable tests)

```toml
[project]
name = "config-pkg"
type = "package"

[scripts]
test = false
```
