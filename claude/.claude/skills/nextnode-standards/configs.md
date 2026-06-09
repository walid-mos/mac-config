# Tooling configs

This file consolidates the smaller per-tool config notes for `@nextnode-solutions/standards`. For larger configs see the dedicated files: `typescript.md`, `tsdown.md`, `vitest.md`, `oxlint.md`.

## semantic-release

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

## commitlint

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

## lint-staged

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

Requires `husky` (v9+) for git hook integration:

```bash
pnpm add -D husky lint-staged better-sort-package-json
pnpm exec husky init
```

---

## oxfmt

**Export path**: `@nextnode-solutions/standards/oxfmt`

**Requires**: `oxfmt >= 0.43.0` (native `oxfmt.config.ts` support)

### Project setup

Create `oxfmt.config.ts` at the project root:

```ts
export { default } from '@nextnode-solutions/standards/oxfmt'
```

To override specific settings:

```ts
import base from '@nextnode-solutions/standards/oxfmt'

export default { ...base, printWidth: 120 }
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
1. Builtins (`import path from 'node:path'`)
2. External (`import express from 'express'`)
3. Internal (`import { db } from '@/lib/db'`)
4. Parent (`import { helper } from '../utils'`)
5. Sibling (`import { schema } from './schema'`)
6. Index (`import { config } from '.'`)

Type imports are grouped with their category but sorted after value imports.

**JSON files**: trailing commas are disabled (JSON spec doesn't allow them).

**`package.json` is ignored by oxfmt** via `ignorePatterns: ['package.json']` - `better-sort-package-json` owns it via lint-staged. Do not override this; the two tools disagree on key order and indentation and will flip-flop every format run.

---

## Tailwind theme

**Export path**: `@nextnode-solutions/standards/tailwind`

### Project setup

Import in your main CSS file:

```css
@import 'tailwindcss';
@import '@nextnode-solutions/standards/tailwind';
```

The Tailwind theme implements the NextNode design system (colors, fonts, spacing). See `/nextnode-design` for the full brand guidelines (color palette, typography roles, logo usage).

---

## editorconfig

**Export path**: `@nextnode-solutions/standards/editorconfig`

Static file. Copy it to your project root:

```bash
cp node_modules/@nextnode-solutions/standards/src/editorconfig/base.editorconfig .editorconfig
```

---

## .npmrc

**Export path**: `@nextnode-solutions/standards/npmrc`

Static file. Copy it to your project root:

```bash
cp node_modules/@nextnode-solutions/standards/src/npmrc/base.npmrc .npmrc
```
