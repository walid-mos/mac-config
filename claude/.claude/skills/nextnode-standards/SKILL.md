---
name: nextnode-standards
description: >-
  How to use @nextnode-solutions/standards in NextNode projects. Covers all
  exported configs: oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged,
  semantic-release, editorconfig, npmrc, and Tailwind theme.
user-invocable: true
synced-at: 1027421
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

Use the relevant sub-file for details:
- [oxlint.md](oxlint.md) — linting rules and overrides
- [oxfmt.md](oxfmt.md) — formatting settings and import sorting
- [typescript.md](typescript.md) — TypeScript configs (library, Next.js, Astro)
- [vitest.md](vitest.md) — test configs (backend, frontend)
- [commitlint.md](commitlint.md) — commit message format and rules
- [lint-staged.md](lint-staged.md) — pre-commit hook commands
- [tailwind.md](tailwind.md) — Tailwind theme, editorconfig, npmrc

### semantic-release

**Export path**: `@nextnode-solutions/standards/semantic-release`

Shared config for semantic-release in monorepo packages. The standards package ships `@semantic-release/git`, `@semantic-release/github`, and `semantic-release-monorepo` as transitive `dependencies` — consumers only need `semantic-release` itself.

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
oxlint.json               # extends standards/oxlint
oxfmt.config.ts           # extends standards/oxfmt (requires oxfmt >=0.43.0)
tsconfig.json             # extends standards/typescript/{library|nextjs|astro}
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

**`packageManager` is required** — The NextNode CI pipeline (`pnpm/action-setup`) reads the pnpm version from this field. Without it, the pipeline will fail. Always pin to an exact version (e.g. `pnpm@10.11.0`), never a range or major-only.

## Rules

1. **Never override core rules** — Only add project-specific overrides. Never weaken `no-explicit-any`, `eqeqeq`, `strict`, etc.
2. **Tabs, not spaces** — oxfmt enforces tabs. Configure your editor accordingly.
3. **No semicolons** — The codebase uses no-semicolon style.
4. **Single quotes** — Except in JSX where double quotes are used.
5. **Import sorting is automatic** — Don't manually sort imports. oxfmt handles it.
6. **Type imports must be separate** — Use `import type { Foo }` not `import { type Foo }`.
