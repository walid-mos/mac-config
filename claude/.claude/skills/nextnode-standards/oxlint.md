# Config: oxlint (Linting)

**Export path**: `@nextnode-solutions/standards/oxlint`

## Project setup

Create `oxlint.json` at the project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "extends": ["@nextnode-solutions/standards/oxlint"]
}
```

## What it enforces

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

## Adding project-specific overrides

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
