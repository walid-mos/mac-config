---
name: nextnode-standards
description: >-
  How to use @nextnode-solutions/standards in NextNode projects. Covers all
  exported configs: oxlint, oxfmt, TypeScript, tsdown, Vitest (backend +
  frontend + astro), commitlint, lint-staged, semantic-release, editorconfig,
  npmrc, and Tailwind theme. Load when @nextnode-solutions/standards appears
  in package.json, when extending one of its configs (e.g. tsconfig
  `extends`, vitest `import from`), or when configuring tooling in a
  NextNode project.
user-invocable: true
synced-at: a755da5
---

# @nextnode-solutions/standards

Centralized development standards for all NextNode projects. This is a **config-only** package - no runtime code, no build step. It exports configuration files that projects extend.

## Arguments

- No argument: full setup guide
- `oxlint`: linting config details
- `typescript`: TypeScript config details
- `tsdown`: bundler config details (for publishable packages)
- `vitest`: test config details
- `configs`: smaller configs (commitlint, lint-staged, oxfmt, Tailwind, editorconfig, npmrc)

## Instructions

### Phase 1: Read the project

1. Read `package.json` - check if `@nextnode-solutions/standards` is installed and which configs are in use
2. Read existing config files (`oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json`, `vitest.config.ts`, etc.)
3. Identify gaps - missing or misconfigured standards

### Phase 2: Provide guidance

Based on the argument, explain the specific config. If no argument, do a full audit of the project's standards compliance.

Use the relevant sub-file for details:
- [oxlint.md](oxlint.md) - linting rules and overrides
- [typescript.md](typescript.md) - TypeScript configs (library, Next.js, Astro)
- [tsdown.md](tsdown.md) - bundler config base for publishable packages
- [vitest.md](vitest.md) - test configs (backend, frontend, **astro**)
- [configs.md](configs.md) - smaller configs: commitlint, lint-staged, oxfmt, Tailwind theme, editorconfig, .npmrc

### Vitest export paths

Three vitest base configs ship - pick by project type:

| Export | When to use |
|--------|-------------|
| `@nextnode-solutions/standards/vitest/backend` | Node libraries (logger, infrastructure, email-manager) |
| `@nextnode-solutions/standards/vitest/frontend` | Browser/React projects |
| `@nextnode-solutions/standards/vitest/astro` | Astro projects (uses `getViteConfig` under the hood) |

There is also a types-only `@nextnode-solutions/standards/vitest/vite-plugin` for projects that need Vitest's type augmentation without bringing in the Vite runtime config.

### semantic-release

**Export path**: `@nextnode-solutions/standards/semantic-release`

Shared config for semantic-release in monorepo packages. The standards package ships `@semantic-release/git`, `@semantic-release/github`, and `semantic-release-monorepo` as transitive `dependencies` - consumers only need `semantic-release` itself.

```json
// .releaserc.json
{
  "extends": ["semantic-release-monorepo", "@nextnode-solutions/standards/semantic-release"],
  "tagFormat": "@nextnode-solutions/<name>-v${version}"
}
```

**Important**: `semantic-release-monorepo` MUST be in the `extends` array (not via CLI `-e` flag). The `-e` flag silently overrides the plugin list from the shared config, dropping `@semantic-release/git`. Order matters: monorepo first, standards second (later entries override earlier ones for `plugins`).

Plugins: commit-analyzer, release-notes-generator, npm, git (commits `package.json` version), github.

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

## Complete project setup checklist

For a typical NextNode project, you need these files:

```
oxlint.config.ts          # extends standards/oxlint (requires oxlint >=1.58.0)
oxfmt.config.ts           # extends standards/oxfmt (requires oxfmt >=0.43.0)
tsconfig.json             # extends standards/typescript/{library|nextjs|astro}
tsdown.config.ts          # imports standards/tsdown (publishable packages)
vitest.config.ts          # imports standards/vitest/{backend|frontend}
commitlint.config.js      # imports standards/commitlint
lint-staged.config.js     # imports standards/lint-staged
.releaserc.json           # extends standards/semantic-release (for publishable packages)
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

**`packageManager` is required** - The NextNode CI pipeline (`pnpm/action-setup`) reads the pnpm version from this field. Without it, the pipeline will fail. Always pin to an exact version (e.g. `pnpm@10.11.0`), never a range or major-only.

## Rules

1. **Never override core rules** - Only add project-specific overrides. Never weaken `no-explicit-any`, `eqeqeq`, `strict`, etc.
2. **Tabs, not spaces** - oxfmt enforces tabs. Configure your editor accordingly.
3. **No semicolons** - The codebase uses no-semicolon style.
4. **Single quotes** - Except in JSX where double quotes are used.
5. **Import sorting is automatic** - Don't manually sort imports. oxfmt handles it.
6. **Type imports must be separate** - Use `import type { Foo }` not `import { type Foo }`.
7. **Astro projects: run `astro check` as part of Definition of Done** - oxlint does not catch TypeScript type errors in `.astro` files. For any Astro project, the sanitization pipeline MUST include both `pnpm run lint` (oxlint) AND `pnpm astro check`. A task is not done until both pass.
8. **Exclude `vitest.config.ts` from tsconfig** - `vitest.config.ts` uses `getViteConfig` (Astro) or Vite's `defineConfig`, which only types the `test` property via Vitest's type augmentation (`/// <reference types="vitest/config" />`). `astro check` and `tsc` don't resolve this augmentation, causing a `ts(2353)` error. Since TypeScript does NOT inherit `exclude` from extended tsconfigs (only `compilerOptions` are merged), every project must add `"exclude": ["vitest.config.ts"]` in its own `tsconfig.json`.
