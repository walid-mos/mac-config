---
name: nextnode-standards
description: >-
  How to use @nextnode-solutions/standards in NextNode projects: all tooling
  configs (oxlint, oxfmt, TypeScript, tsdown, Vitest, commitlint,
  semantic-release, Tailwind). Load when @nextnode-solutions/standards is in
  package.json or when configuring tooling in a NextNode project.
---

# @nextnode-solutions/standards

**Source**: @nextnode/core @ 7185a94 (resync 2026-08-16)

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
- [vitest.md](vitest.md) - test configs and all export paths (backend, frontend, astro, vite-plugin)
- [configs.md](configs.md) - commitlint, lint-staged, oxfmt, Tailwind theme, editorconfig, .npmrc, semantic-release

---

## Installation

```bash
# Required peer dependencies
pnpm add -D @nextnode-solutions/standards oxlint oxfmt

# Optional peer dependencies (install only what you use)
pnpm add -D vitest                                              # If you have tests
pnpm add -D oxlint-tsgolint                                     # If you want type-aware oxlint rules (--type-aware)
pnpm add -D @commitlint/cli @commitlint/config-conventional     # If you want commit linting
pnpm add -D tailwindcss                                         # If you use Tailwind
```

---

## Complete project setup checklist

For a typical NextNode project, you need these files:

```
oxlint.config.ts          # extends standards/oxlint (requires oxlint >=1.62.0)
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
  "packageManager": "pnpm@<current-pnpm-version>",
  "scripts": {
    "lint": "oxlint",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  }
}
```

**`packageManager` is required** - The NextNode CI pipeline (`pnpm/action-setup`) reads the pnpm version from this field. Without it, the pipeline will fail. Always pin to the exact version in use in the monorepo (check the root `package.json`) - never a range or major-only.

## Rules

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Weakening core oxlint rules (`no-explicit-any`, `eqeqeq`, `strict`, etc.) | Add project-specific overrides only on top of the base config |
| Hand-formatting against oxfmt (spaces, semicolons, double quotes, manual import order) | Let oxfmt enforce: tabs, no semis, single quotes (JSX double), auto import sort |
| Inline type imports: `import { type Foo }` | Separate type imports: `import type { Foo }` |
| Skipping `astro check` on Astro projects | Run both `pnpm run lint` (oxlint) AND `pnpm astro check` |
| Relying on extended tsconfig to inherit `exclude` | Add `"exclude": ["vitest.config.ts"]` in every project's own `tsconfig.json` |
| Ranging or omitting `packageManager` field | Pin exact pnpm version matching the monorepo root `package.json` |
| Copying a tooling pattern from an existing repo without checking upstream | ALWAYS fetch the current best practice from the tool's official docs (husky, pnpm, turbo, …) before scaffolding — patterns in older repos (and even in this skill) can lag upstream. Canonical example: the husky CI guard (`.husky/install.mjs`, see configs.md for the docs link) — not a `[ -n "$CI" ] \|\| husky` shell one-liner |
| Scaffolding or pinning a new Astro app on astro 6 | New Astro apps ALWAYS use Astro 7 (`pnpm create astro@latest`); astro 6 is legacy-only for apps not yet migrated (peer range `^6.0.0 \|\| ^7.0.0` since core#55) |
| Pinning a new project to TypeScript 5.x/6.x | New projects ALWAYS use TypeScript 7 (`typescript@^7`, native compiler, `tsc` drop-in); 5.x/6.x are legacy-only for repos not yet migrated. EXCEPTION: Astro apps stay on `^6` — `astro check` hard-fails on ts7 (missing programmatic API, see typescript.md for the upstream link) |
