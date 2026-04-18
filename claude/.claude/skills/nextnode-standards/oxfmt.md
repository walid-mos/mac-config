# Config: oxfmt (Formatting)

**Export path**: `@nextnode-solutions/standards/oxfmt`

**Requires**: `oxfmt >= 0.43.0` (native `oxfmt.config.ts` support)

## Project setup

Create `oxfmt.config.ts` at the project root:

```ts
export { default } from '@nextnode-solutions/standards/oxfmt'
```

To override specific settings:

```ts
import base from '@nextnode-solutions/standards/oxfmt'

export default { ...base, printWidth: 120 }
```

## What it enforces

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

**`package.json` is ignored by oxfmt entirely** (via `ignorePatterns: ['package.json']` in the base config). Reason: oxfmt has a built-in package.json key sorter triggered by filename that is incompatible with `better-sort-package-json`. The two tools disagree on both key order and indentation, causing a flip-flop where every bulk format run rewrites the file. `better-sort-package-json` owns `package.json` exclusively via lint-staged (routed through the `'package.json'` glob in the lint-staged config). If a project needs to override this and have oxfmt process `package.json`, spread `base` and override `ignorePatterns` — but that brings back the flip-flop with lint-staged, so don't.
