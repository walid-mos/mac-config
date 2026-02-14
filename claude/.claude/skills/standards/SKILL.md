---
name: standards
description: "@nextnode-solutions/standards package reference — exports, config setup, formatting rules. For compliance auditing, see /nextnode-standards."
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# @nextnode-solutions/standards — Package Reference

`@nextnode-solutions/standards` is the centralized development standards package for all NextNode projects. It provides shared configs for linting, formatting, TypeScript, Tailwind, testing, and commit conventions.

- **Package:** `@nextnode-solutions/standards` (npm, public)
- **Repository:** `NextNodeSolutions/standards`
- **Required peer deps:** `oxlint` (required), `oxfmt` (required)
- **Optional peer deps:** `tailwindcss`, `vitest`, `@commitlint/cli`, `@commitlint/config-conventional`

> **Compliance auditing** is handled by `/nextnode-standards` (auto-loaded + user-invocable). This skill is a reference for the package exports and config patterns.

---

## 1. Available Exports

| Import Path | What It Provides | Config File |
|---|---|---|
| `@nextnode-solutions/standards/oxlint` | oxlint base config | `oxlint.json` |
| `@nextnode-solutions/standards/oxfmt` | oxfmt formatter config | `oxfmt.json` |
| `@nextnode-solutions/standards/typescript/library` | tsconfig for libraries/packages | `tsconfig.json` |
| `@nextnode-solutions/standards/typescript/nextjs` | tsconfig for Next.js apps | `tsconfig.json` |
| `@nextnode-solutions/standards/typescript/astro` | tsconfig for Astro apps | `tsconfig.json` |
| `@nextnode-solutions/standards/tailwind` | Tailwind CSS v4 theme (CSS) | CSS `@import` |
| `@nextnode-solutions/standards/vitest/frontend` | Vitest config (jsdom, coverage) | `vitest.config.ts` |
| `@nextnode-solutions/standards/vitest/backend` | Vitest config (node, coverage) | `vitest.config.ts` |
| `@nextnode-solutions/standards/commitlint` | Commitlint conventional config | `commitlint.config.js` |
| `@nextnode-solutions/standards/editorconfig` | EditorConfig base config | `.editorconfig` (symlink/copy) |
| `@nextnode-solutions/standards/npmrc` | pnpm .npmrc config | `.npmrc` (symlink/copy) |
| `@nextnode-solutions/standards/lint-staged` | lint-staged config (oxlint + oxfmt + sort-package-json) | `lint-staged.config.js` |

---

## 2. Installation

```bash
pnpm add -D @nextnode-solutions/standards oxlint oxfmt
```

For optional features:

```bash
# Tailwind support
pnpm add -D tailwindcss

# Testing
pnpm add -D vitest

# Commit linting (with husky + lint-staged)
pnpm add -D @commitlint/cli @commitlint/config-conventional husky lint-staged better-sort-package-json
```

---

## 3. Configuration Setup Per Tool

### 4.1 oxlint — `oxlint.json`

Create `oxlint.json` at project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "extends": ["@nextnode-solutions/standards/oxlint"]
}
```

**What it enforces:**
- Categories: `correctness` (error), `suspicious` (warn), `perf` (warn)
- Plugins: `typescript`, `react`, `unicorn`, `import`
- Key rules: no-unused-vars (error), no-explicit-any (error), consistent-type-imports (error), explicit-function-return-type (error), eqeqeq (error), prefer-const (error), no-var (error), complexity max 15, no-magic-numbers
- Overrides: relaxed rules for `*.config.*`, `*.test.*`, `*.spec.*` files

### 4.2 oxfmt — `oxfmt.json`

Create `oxfmt.json` at project root:

```json
{
  "extends": ["@nextnode-solutions/standards/oxfmt"]
}
```

**What it enforces:**
- Tabs (width 4), LF line endings, 80 char print width
- No semicolons, single quotes, trailing commas
- No arrow parens (avoid), bracket spacing
- Tailwind class sorting (experimental)
- Import sorting with grouped newlines (side-effect > builtin > external > internal > parent > sibling > index)

### 4.3 TypeScript — `tsconfig.json`

Extend the appropriate base depending on project type:

**Library/Package:**
```json
{
  "extends": "@nextnode-solutions/standards/typescript/library",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Next.js App:**
```json
{
  "extends": "@nextnode-solutions/standards/typescript/nextjs",
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Astro App:**
```json
{
  "extends": "@nextnode-solutions/standards/typescript/astro",
  "include": ["src", "env.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**What it enforces (all variants):**
- `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `noImplicitReturns`
- Library variant adds: `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports`
- ESNext module with bundler resolution
- `noEmit: true` (type-checking only)

### 4.4 Tailwind v4 — CSS `@import`

In the project's main CSS file (e.g., `app.css`, `global.css`):

```css
@import "tailwindcss";
@import "@nextnode-solutions/standards/tailwind";
```

No `tailwind.config.ts` needed — Tailwind v4 uses CSS-first configuration.

**What it provides:**
- `--breakpoint-xs: 30rem` (extra-small breakpoint for mobile-first layouts)

### 4.5 Vitest — `vitest.config.ts`

**Frontend (jsdom):**
```ts
import { defineConfig, mergeConfig } from 'vitest/config'

import standards from '@nextnode-solutions/standards/vitest/frontend'

export default mergeConfig(standards, defineConfig({
  test: {
    // project-specific overrides here
  },
}))
```

**Backend (node):**
```ts
import { defineConfig, mergeConfig } from 'vitest/config'

import standards from '@nextnode-solutions/standards/vitest/backend'

export default mergeConfig(standards, defineConfig({
  test: {
    // project-specific overrides here
  },
}))
```

**What it provides:**
- `globals: true`, auto mock cleanup (`restoreMocks`, `clearMocks`, `unstubGlobals`)
- V8 coverage with sensible excludes (reporters: `json`, `html`, `text`)
- Frontend: `jsdom` environment, coverage enabled by default
- Backend: `node` environment with `NODE_ENV=test`

### 4.6 Commitlint — `commitlint.config.js`

```js
export { default } from '@nextnode-solutions/standards/commitlint'
```

**What it enforces:**
- Conventional Commits types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Lowercase type and scope, no period in subject, max 100 char header
- Body/footer: leading blank line, max 100 char lines

### 4.7 EditorConfig — `.editorconfig`

Copy or symlink the base config to the project root:

```bash
cp node_modules/@nextnode-solutions/standards/src/editorconfig/base.editorconfig .editorconfig
```

**What it enforces:**
- Tabs (indent size 4), LF line endings, UTF-8 charset
- Trim trailing whitespace, insert final newline
- Markdown files: preserve trailing whitespace

### 4.8 npmrc — `.npmrc`

Copy or symlink the base config to the project root:

```bash
cp node_modules/@nextnode-solutions/standards/src/npmrc/base.npmrc .npmrc
```

**What it enforces:**
- `strict-peer-dependencies=false` (don't fail on optional peer dep mismatches)
- `auto-install-peers=true` (auto-install peer deps)
- `shamefully-hoist=false` (strict node_modules isolation)

### 4.9 lint-staged — `lint-staged.config.js`

```js
export { default } from '@nextnode-solutions/standards/lint-staged'
```

**What it runs on staged files:**
- `package.json` -> `better-sort-package-json`
- All files (`*`) -> `oxlint` then `oxfmt --no-error-on-unmatched-pattern --write`

---

## 4. Required `package.json` Scripts

Every project MUST have these scripts:

```json
{
  "scripts": {
    "lint": "oxlint",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "prepare": "husky"
  }
}
```

Add if using vitest:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 5. Husky Git Hooks

After installing husky, set up hooks:

```bash
pnpm exec husky init
```

**`.husky/pre-commit`:**
```sh
pnpm exec lint-staged
```

**`.husky/commit-msg`:**
```sh
pnpm exec commitlint --edit $1
```

---

## 6. Formatting Rules for Code Generation

When generating or editing code in any NextNode project, **always follow the oxfmt config**:

- **Indentation:** tabs (width 4)
- **Line endings:** LF
- **Print width:** 80 characters
- **Semicolons:** none
- **Quotes:** single quotes (double in JSX)
- **Trailing commas:** always (except JSON)
- **Arrow parens:** avoid (`x => x`, not `(x) => x`)
- **Bracket spacing:** yes (`{ foo }` not `{foo}`)
- **Bracket same line:** no (closing `>` on new line for multi-line JSX)
- **Import order:** side-effect > builtin > external > internal > parent > sibling > index (blank line between groups)
- **Type imports:** always use `import type` (separate, top-level)

---

## 7. When Creating a New NextNode Project

When scaffolding a new project, **always set up @nextnode-solutions/standards from the start**:

1. Install the package and required peer deps
2. Create all config files per section 3 (pick the right TypeScript variant)
3. Copy `.editorconfig` and `.npmrc` from the package (section 3.7 and 3.8)
4. Add package.json scripts per section 4
5. Set up husky + lint-staged + commitlint per section 5
6. Verify with `pnpm lint` and `pnpm format:check`

**Never create a NextNode project without `@nextnode-solutions/standards`.** This is non-negotiable.

---

## 8. Project Overrides

Projects MAY extend/override specific rules in their local config files, but they MUST always extend from `@nextnode-solutions/standards` as the base. Direct configs that don't extend from standards are **not allowed**.

**Allowed:**
```json
{
  "$schema": "...",
  "extends": ["@nextnode-solutions/standards/oxlint"],
  "rules": {
    "eslint/no-console": "off"
  }
}
```

**NOT allowed:**
```json
{
  "rules": {
    "eslint/no-console": "off"
  }
}
```
