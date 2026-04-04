---
name: nextnode-standards
description: >-
  How to use @nextnode-solutions/standards in NextNode projects. Covers all
  exported configs: oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged,
  editorconfig, npmrc, and Tailwind theme.
user-invocable: true
---

# @nextnode-solutions/standards

Centralized development standards for all NextNode projects. This is a **config-only** package — no runtime code, no build step. It exports configuration files that projects extend.

## Arguments

- No argument: full setup guide
- `oxlint`: linting config details
- `oxfmt`: formatting config details
- `typescript`: TypeScript config details
- `vitest`: test config details
- `commitlint`: commit message config
- `lint-staged`: pre-commit hooks config
- `tailwind`: Tailwind theme

## Instructions

### Phase 1: Read the project

1. Read `package.json` — check if `@nextnode-solutions/standards` is installed and which configs are in use
2. Read existing config files (`oxlint.json`, `.oxfmt.json`, `tsconfig.json`, `vitest.config.ts`, etc.)
3. Identify gaps — missing or misconfigured standards

### Phase 2: Provide guidance

Based on the argument, explain the specific config. If no argument, do a full audit of the project's standards compliance.

---

## Installation

```bash
# Required peer dependencies
pnpm add -D @nextnode-solutions/standards oxlint oxfmt

# Optional peer dependencies (install only what you use)
pnpm add -D vitest                                              # If you have tests
pnpm add -D @commitlint/cli @commitlint/config-conventional     # If you want commit linting
pnpm add -D tailwindcss                                         # If you use Tailwind
```

---

## Config: oxlint (Linting)

**Export path**: `@nextnode-solutions/standards/oxlint`

### Project setup

Create `oxlint.json` at the project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "extends": ["@nextnode-solutions/standards/oxlint"]
}
```

### What it enforces

**Plugins**: typescript, react, unicorn, import

**Categories**:
- `correctness` -> error
- `suspicious` -> warn
- `perf` -> warn

**Key rules**:
| Rule | Level | What it does |
|------|-------|-------------|
| `no-unused-vars` | error | No dead code (ignoreRestSiblings: true) |
| `prefer-const` | error | Use const when not reassigned |
| `no-var` | error | Ban var declarations |
| `eqeqeq` | error | Strict equality only |
| `no-console` | warn | Flag console.log (use logger instead) |
| `complexity` | error | Max cyclomatic complexity: 15 |
| `no-magic-numbers` | error | Extract constants (0, 1, -1 allowed) |
| `no-explicit-any` | error | Ban `any` type |
| `consistent-type-imports` | error | Use `import type` for type-only imports |
| `explicit-function-return-type` | error | Functions must declare return types |
| `exhaustive-deps` | warn | React hooks dependency check |
| `rules-of-hooks` | error | React hooks rules |

**Relaxed for config/test files** (`*.config.*`, `*.test.*`, `*.spec.*`):
- `no-console` -> off
- `no-explicit-any` -> warn (instead of error)
- `no-magic-numbers` -> off

### Adding project-specific overrides

```json
{
  "extends": ["@nextnode-solutions/standards/oxlint"],
  "rules": {
    "eslint/no-console": "off"
  },
  "overrides": [
    {
      "files": ["src/migrations/**"],
      "rules": {
        "eslint/no-magic-numbers": "off"
      }
    }
  ]
}
```

---

## Config: oxfmt (Formatting)

**Export path**: `@nextnode-solutions/standards/oxfmt`

### Project setup

Create `.oxfmt.json` at the project root:

```json
{
  "extends": ["@nextnode-solutions/standards/oxfmt"]
}
```

### What it enforces

| Setting | Value |
|---------|-------|
| Indentation | Tabs (width 4) |
| Line endings | LF |
| Print width | 80 |
| Trailing commas | All |
| Semicolons | None |
| Arrow parens | Avoid (single param) |
| Bracket spacing | Yes |
| Quotes | Single quotes (JSX: double) |
| Bracket same line | No |
| Import sorting | Automatic (grouped by type) |
| Tailwind CSS | Experimental support enabled |

**Import sort order**:
1. Side effects (`import './polyfill'`)
2. Builtins (`import path from 'node:path'`)
3. External (`import express from 'express'`)
4. Internal (`import { db } from '@/lib/db'`)
5. Parent (`import { helper } from '../utils'`)
6. Sibling (`import { schema } from './schema'`)
7. Index (`import { config } from '.'`)

Type imports are grouped with their category but sorted after value imports.

**JSON files**: trailing commas are disabled (JSON spec doesn't allow them).

---

## Config: TypeScript

**Export paths**:
- `@nextnode-solutions/standards/typescript/library` — for npm packages
- `@nextnode-solutions/standards/typescript/nextjs` — for Next.js apps
- `@nextnode-solutions/standards/typescript/astro` — for Astro apps

### Project setup

Create `tsconfig.json` at the project root:

```jsonc
// For a library/package
{
  "extends": "@nextnode-solutions/standards/typescript/library",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}

// For a Next.js app
{
  "extends": "@nextnode-solutions/standards/typescript/nextjs",
  "include": ["src", "next-env.d.ts"],
  "exclude": ["node_modules", ".next"]
}

// For an Astro app
{
  "extends": "@nextnode-solutions/standards/typescript/astro",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Library config highlights

- **Target**: ES2023
- **Module**: ESNext with bundler resolution
- **Maximum strictness**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`
- **ESM-ready**: `isolatedModules`, `verbatimModuleSyntax`
- **No emit**: uses tsup/other bundler for output

### Next.js config highlights

- Same strictness as library (minus `exactOptionalPropertyTypes` and `verbatimModuleSyntax`)
- `jsx: "preserve"` (Next.js handles JSX transform)
- `incremental: true` for faster rebuilds
- Includes `dom` and `dom.iterable` libs

### Astro config highlights

- Extends `astro/tsconfigs/strict`
- `module: "preserve"` (Astro handles resolution)
- Target ES2022

---

## Config: Vitest (Testing)

**Export paths**:
- `@nextnode-solutions/standards/vitest/backend` — Node.js environment
- `@nextnode-solutions/standards/vitest/frontend` — jsdom environment

### Project setup

Create `vitest.config.ts` at the project root:

```typescript
// Backend (API, CLI, libraries)
import config from '@nextnode-solutions/standards/vitest/backend'

export default config

// Frontend (React, Astro, browser code)
import config from '@nextnode-solutions/standards/vitest/frontend'

export default config
```

### To extend/override

```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '@nextnode-solutions/standards/vitest/backend'

export default mergeConfig(baseConfig, defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
}))
```

### Backend config

- **Environment**: Node.js
- **Globals**: enabled (`describe`, `it`, `expect` without imports)
- **NODE_ENV**: set to `"test"`
- **Mock cleanup**: `restoreMocks`, `clearMocks`, `unstubGlobals` all true
- **Coverage**: v8 provider, excludes node_modules, dist, .d.ts, test/spec/config files, types.ts

### Frontend config

- **Environment**: jsdom
- **Globals**: enabled
- **Mock cleanup**: same as backend
- **Coverage**: v8 provider, additionally excludes .astro/, coverage/, tests/, config/, types/

---

## Config: commitlint (Commit Messages)

**Export path**: `@nextnode-solutions/standards/commitlint`

### Project setup

Create `commitlint.config.js` at the project root:

```javascript
import config from '@nextnode-solutions/standards/commitlint'

export default config
```

### Rules

**Format**: `type(scope): subject`

**Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Constraints**:
- Type: lowercase, required
- Scope: lowercase, optional
- Subject: no sentence-case, no start-case, no pascal-case, no upper-case, no period at end, required
- Header: max 100 chars
- Body: max 100 chars per line, blank line before body and footer

**Examples**:
```
feat(auth): add JWT refresh token rotation
fix: prevent race condition in state update
docs(api): update endpoint documentation
refactor(logger): extract transport interface
```

---

## Config: lint-staged (Pre-commit Hooks)

**Export path**: `@nextnode-solutions/standards/lint-staged`

### Project setup

Create `lint-staged.config.js` at the project root:

```javascript
import config from '@nextnode-solutions/standards/lint-staged'

export default config
```

### What it runs

| File pattern | Commands |
|-------------|----------|
| `package.json` | `better-sort-package-json` |
| `*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}` | `oxlint` then `oxfmt --write` |
| `*.json` | `oxfmt --write` |

Requires `husky` for git hook integration:

```bash
pnpm add -D husky lint-staged better-sort-package-json
pnpm exec husky init
```

---

## Config: Tailwind Theme

**Export path**: `@nextnode-solutions/standards/tailwind`

### Project setup

Import in your main CSS file:

```css
@import 'tailwindcss';
@import '@nextnode-solutions/standards/tailwind';
```

---

## Config: editorconfig & npmrc

**Export paths**:
- `@nextnode-solutions/standards/editorconfig`
- `@nextnode-solutions/standards/npmrc`

These are static files. Copy them to your project root:

```bash
cp node_modules/@nextnode-solutions/standards/src/editorconfig/base.editorconfig .editorconfig
cp node_modules/@nextnode-solutions/standards/src/npmrc/base.npmrc .npmrc
```

---

## Complete project setup checklist

For a typical NextNode project, you need these files:

```
oxlint.json               # extends standards/oxlint
.oxfmt.json               # extends standards/oxfmt
tsconfig.json             # extends standards/typescript/{library|nextjs|astro}
vitest.config.ts          # imports standards/vitest/{backend|frontend}
commitlint.config.js      # imports standards/commitlint
lint-staged.config.js     # imports standards/lint-staged
.editorconfig             # copied from standards
.npmrc                    # copied from standards
```

And these package.json fields:

```json
{
  "packageManager": "pnpm@10.11.0",
  "scripts": {
    "lint": "oxlint",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  }
}
```

**`packageManager` is required** — The NextNode CI pipeline (`pnpm/action-setup`) reads the pnpm version from this field. Without it, the pipeline will fail. Always pin to an exact version (e.g. `pnpm@10.11.0`), never a range or major-only.

## Rules

1. **Never override core rules** — Only add project-specific overrides. Never weaken `no-explicit-any`, `eqeqeq`, `strict`, etc.
2. **Tabs, not spaces** — oxfmt enforces tabs. Configure your editor accordingly.
3. **No semicolons** — The codebase uses no-semicolon style.
4. **Single quotes** — Except in JSX where double quotes are used.
5. **Import sorting is automatic** — Don't manually sort imports. oxfmt handles it.
6. **Type imports must be separate** — Use `import type { Foo }` not `import { type Foo }`.
