# Config: oxfmt (Formatting)

**Export path**: `@nextnode-solutions/standards/oxfmt`

## Project setup

Create `.oxfmt.json` at the project root:

```json
{
  "extends": ["@nextnode-solutions/standards/oxfmt"]
}
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
