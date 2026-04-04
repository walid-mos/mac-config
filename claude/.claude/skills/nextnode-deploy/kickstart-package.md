# Kickstarting a New Package

Step-by-step guide to add a new publishable package to the `@nextnode/core` monorepo with a fully working CI/CD pipeline. Based on the working `logger` and `standards` packages.

## Directory structure

```
packages/<name>/
  src/
    index.ts              # or named entry point(s)
  package.json
  nextnode.toml
  .releaserc.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts        # if the package has tests
  .oxlintrc.json
  .oxfmtrc.json
```

## 1. package.json

Critical fields for publishing:

```jsonc
{
  "name": "@nextnode-solutions/<name>",
  "version": "0.0.0-development",       // semantic-release manages this
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],                     // or ["src"] for config-only packages
  "exports": {
    ".": {
      "types": "./dist/<entry>.d.ts",
      "import": "./dist/<entry>.js"
    }
  },
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "lint": "oxlint",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@nextnode-solutions/standards": "workspace:*",
    "oxfmt": "^0.28.0",
    "oxlint": "^1.43.0",
    "tsup": "^8.5.1",
    "typescript": "^6",
    "vitest": "^3"
  },
  "engines": {
    "node": ">=24.0.0"
  },
  "packageManager": "pnpm@10.11.0"
}
```

**Key points**:
- `version` is always `0.0.0-development` — semantic-release bumps it on publish
- `files` controls what goes to npm — only include `dist` (or `src` for config packages like standards)
- `publishConfig.access: "public"` is required for scoped public packages
- Use `workspace:*` for internal deps (`@nextnode-solutions/standards`)
- `sideEffects: false` enables tree-shaking for consumers

### Config-only packages (no build)

If the package exports raw source files (like `standards`):

```jsonc
{
  "files": ["src"],
  "exports": {
    "./some-config": "./src/some-config/base.json"
  },
  "scripts": {
    "build": "echo 'No build step needed for config package'",
    "test": "echo 'Configuration package — no tests needed'"
  }
}
```

## 2. nextnode.toml

```toml
[project]
name = "<name>"                              # directory name under packages/
type = "package"                             # triggers publish-package.yml flow
filter = "@nextnode-solutions/<name>"        # turbo --filter value

[package]
access = "public"
```

**Optional overrides**:

```toml
[scripts]
test = false        # disable test in quality matrix (config-only packages)
```

The `filter` field is used by turbo in CI: `pnpm turbo run build --filter=@nextnode-solutions/<name>`.

## 3. .releaserc.json

```json
{
  "extends": ["semantic-release-monorepo", "@nextnode-solutions/standards/semantic-release"],
  "tagFormat": "@nextnode-solutions/<name>-v${version}"
}
```

**Important**: `semantic-release-monorepo` MUST be in the `extends` array, NOT via CLI `-e` flag. The `-e` flag silently overrides the plugin list from the shared config. Order matters: monorepo first, standards second.

**What the base config does** (from `standards/src/semantic-release/base.js`):

| Plugin | Purpose |
|--------|---------|
| `@semantic-release/commit-analyzer` | Determine version bump from conventional commits |
| `@semantic-release/release-notes-generator` | Generate CHANGELOG entries |
| `@semantic-release/npm` | Publish to npm |
| `@semantic-release/git` | Commit updated `package.json`, tag with `[skip ci]` |
| `@semantic-release/github` | Create GitHub release |

The `tagFormat` is critical in a monorepo — each package needs a unique tag prefix to avoid collisions.

## 4. tsconfig.json

```json
{
  "extends": "@nextnode-solutions/standards/typescript/library",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node", "vitest/globals"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Add `"lib": ["ES2023", "DOM"]` in `compilerOptions` if the package targets browser environments.

## 5. tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    '<entry>': 'src/<entry>.ts',
  },
  format: ['esm'],
  dts: true,
  treeshake: true,
  clean: true,
  target: 'es2023',
  splitting: true,
})
```

Each key in `entry` maps to an export in `package.json`. Example with multiple entry points:

```typescript
entry: {
  logger: 'src/logger.ts',
  testing: 'src/testing/test-utils.ts',
  'transports/http': 'src/transports/http.ts',
},
```

This produces `dist/logger.js`, `dist/testing.js`, `dist/transports/http.js` with matching `.d.ts` files.

## 6. vitest.config.ts

```typescript
import { resolve } from 'node:path'

import baseConfig from '@nextnode-solutions/standards/vitest/backend'
import { defineConfig, mergeConfig } from 'vitest/config'

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    test: {
      include: ['src/**/*.{test,spec}.ts'],
    },
  }),
)
```

For packages with no tests, set `test = false` in `nextnode.toml` `[scripts]` section and omit this file.

## 7. Linting and formatting configs

### .oxlintrc.json

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "extends": [
    "./node_modules/@nextnode-solutions/standards/src/oxlint/base.json"
  ]
}
```

Add rule overrides as needed:

```json
{
  "rules": {
    "no-console": "off"
  },
  "overrides": [
    {
      "files": ["**/*.spec.ts", "**/*.test.ts"],
      "rules": {
        "unicorn/consistent-function-scoping": "off"
      }
    }
  ]
}
```

### .oxfmtrc.json

Copy from an existing package (e.g. `packages/logger/.oxfmtrc.json`). All packages use the same formatting config.

## 8. GitHub workflow

Create `.github/workflows/<name>.yml`:

```yaml
name: <Name>

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths: ["packages/<name>/**"]
  pull_request:
    paths: ["packages/<name>/**"]

jobs:
  pipeline:
    uses: ./.github/workflows/publish-package.yml
    with:
      config_file: packages/<name>/nextnode.toml
    secrets: inherit
```

This is the only file needed — it delegates to the shared `publish-package.yml` reusable workflow.

## Pipeline flow

```
Push to main (packages/<name>/**)
  |
  v
<name>.yml
  |
  v
publish-package.yml
  |
  +-- Plan: parse nextnode.toml -> quality_matrix, project_name, project_filter, publish
  |
  +-- Quality (matrix): lint, test (parallel, from scripts config)
  |
  +-- Publish (main only, after quality passes):
        1. Build:  pnpm turbo run build --filter=@nextnode-solutions/<name>
        2. Token:  GitHub App token via NEXTNODE_APP_ID + NEXTNODE_APP_PRIVATE_KEY
        3. Tags:   git tag -l | xargs -r git tag -d  (clear local tags)
        4. Release: pnpm exec semantic-release
        5. Summary: infra publish-result parses output
```

## Required secrets

Already configured at the org/repo level:

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm registry authentication |
| `NEXTNODE_APP_ID` | GitHub App for generating commit tokens |
| `NEXTNODE_APP_PRIVATE_KEY` | GitHub App private key |

## Checklist

Before pushing:

- [ ] `package.json` has `version: "0.0.0-development"` and `publishConfig.access: "public"`
- [ ] `nextnode.toml` has correct `name`, `type = "package"`, and `filter`
- [ ] `.releaserc.json` has unique `tagFormat` with package name prefix
- [ ] `tsup.config.ts` entry points match `package.json` exports
- [ ] `.github/workflows/<name>.yml` exists with correct `paths` filter and `config_file`
- [ ] `pnpm install` works from root (new package is auto-detected by workspace)
- [ ] `pnpm turbo run build --filter=@nextnode-solutions/<name>` succeeds
- [ ] `pnpm turbo run lint --filter=@nextnode-solutions/<name>` passes
- [ ] `pnpm turbo run test --filter=@nextnode-solutions/<name>` passes (or test is disabled)

## Common issues

**semantic-release finds no commits**: Tag format mismatch. Verify `.releaserc.json` `tagFormat` matches the pattern `@nextnode-solutions/<name>-v${version}`.

**Publish fails with 403**: Check `publishConfig.access` is `"public"` and `NPM_TOKEN` has publish permissions for the `@nextnode-solutions` scope.

**Quality matrix is empty**: The plan job skips quality when both `lint` and `test` are `false` in `[scripts]`. Verify your `nextnode.toml`.

**Build not found in dist**: Ensure `tsup.config.ts` entry keys match what `package.json` exports reference. The `files` field must include `dist`.

**turbo cache misses**: Verify `filter` in `nextnode.toml` matches exactly the `name` in `package.json` (e.g. `@nextnode-solutions/logger`).
