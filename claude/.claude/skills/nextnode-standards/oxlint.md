# Config: oxlint (Linting)

**Export path**: `@nextnode-solutions/standards/oxlint`
**Required version**: oxlint >= 1.58.0

## Project setup

Create `oxlint.config.ts` at the project root:

```ts
import standardsConfig from '@nextnode-solutions/standards/oxlint'
import { defineConfig } from 'oxlint'

export default defineConfig({
	extends: [standardsConfig],
})
```

## What it enforces

**Plugins**: typescript, react, unicorn, import
**Custom plugins**: `no-type-assertion` - bundled inside `@nextnode-solutions/standards` (bans `as` type assertions, allows `as const`; no separate install required)

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
| `no-debugger` | error | No debugger statements |
| `eqeqeq` | error | Strict equality only |
| `prefer-template` | error | Use template literals over concatenation |
| `arrow-body-style` | error | Concise arrow function bodies |
| `no-console` | warn | Flag console.log (use logger instead) |
| `complexity` | error | Max cyclomatic complexity: 15 |
| `no-magic-numbers` | error | Extract constants (0, 1, -1 allowed) |
| `no-explicit-any` | error | Ban `any` type |
| `consistent-type-imports` | error | Use `import type` for type-only imports |
| `consistent-type-specifier-style` | error | Prefer top-level type imports |
| `explicit-function-return-type` | error | Functions must declare return types |
| `no-dynamic-delete` | error | No `delete obj[key]` |
| `no-type-assertion` | error | Custom: bans `as` casts (allows `as const`) |
| `exhaustive-deps` | warn | React hooks dependency check |
| `rules-of-hooks` | error | React hooks rules |

**Relaxed for config/test files** (`*.config.*`, `*.test.*`, `*.spec.*`):
- `no-console` -> off
- `no-explicit-any` -> warn (instead of error)
- `no-magic-numbers` -> off

## Adding project-specific overrides

```ts
import standardsConfig from '@nextnode-solutions/standards/oxlint'
import { defineConfig } from 'oxlint'

export default defineConfig({
	extends: [standardsConfig],
	rules: {
		'eslint/no-console': 'off',
	},
	overrides: [
		{
			files: ['src/migrations/**'],
			rules: {
				'eslint/no-magic-numbers': 'off',
			},
		},
	],
})
```
