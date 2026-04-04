# Config: lint-staged (Pre-commit Hooks)

**Export path**: `@nextnode-solutions/standards/lint-staged`

## Project setup

Create `lint-staged.config.js` at the project root:

```javascript
import config from '@nextnode-solutions/standards/lint-staged'

export default config
```

## What it runs

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
