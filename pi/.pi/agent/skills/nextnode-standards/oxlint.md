# Config: oxlint (Linting)

**Export path**: `@nextnode-solutions/standards/oxlint`
**Required version**: oxlint >= 1.62.0 (peer). Optional peer for type-aware rules: oxlint-tsgolint >= 0.23.0.

## Project setup

Create `oxlint.config.ts` at the project root:

```ts
import standardsConfig from '@nextnode-solutions/standards/oxlint'
import { defineConfig } from 'oxlint'

export default defineConfig({
	extends: [standardsConfig],
})
```

Type-aware rules activate only with `oxlint --type-aware` (requires `oxlint-tsgolint` installed and a `tsconfig.json`). Without the flag the config still loads; those six rules stay dormant.

## What it enforces

**Plugins**: typescript, react, unicorn, import, promise
**Custom JS plugin** `nextnode` - bundled inside the package, 23 rules mechanizing the NextNode coding skills (no separate install).

**Categories**: `correctness` -> error, `suspicious` -> warn, `perf` -> warn.

### Core style and size caps (eslint)

| Rule | Level | What it does |
|------|-------|-------------|
| `no-unused-vars`, `prefer-const`, `no-var`, `no-debugger` | error | Basics |
| `eqeqeq` | error | Strict equality only - `value == null` is flagged too |
| `prefer-template`, `arrow-body-style` | error | Template literals; concise arrows |
| `no-console` | warn | Use the logger |
| `complexity` | error | Max cyclomatic complexity 15 |
| `max-depth` | error | Max nesting 2 |
| `max-nested-callbacks` | error | Max 3 (off in test files - vitest DSL) |
| `max-lines-per-function` | error | Max 50 (skip blanks/comments) |
| `max-lines` | error | Max 250 per file |
| `max-params` | error | Max 4 params (SRP proxy) |
| `no-magic-numbers` | error | Extract constants (0, 1, -1 allowed) |
| `no-param-reassign` | error | No mutating params, incl. their props |
| `no-else-return`, `no-lonely-if`, `no-negated-condition` | error | Flat, positive conditionals |
| `no-empty`, `no-empty-function` | error | (arrow fns allowed) |
| `no-eval`, `prefer-rest-params` | error | No eval; `...args` over `arguments` |
| `guard-for-in` | error | Guard `for...in` bodies |
| `preserve-caught-error` | error | Re-throws must carry `{ cause }` |
| `prefer-destructuring`, `no-await-in-loop`, `no-underscore-dangle` | warn | Judgment tripwires |

### Plugins

| Rule | Level | What it does |
|------|-------|-------------|
| `promise/prefer-await-to-then` | warn | async/await over .then (warn: `.catch(report)` detach is sanctioned) |
| `unicorn/no-array-sort` | error | `toSorted()` over in-place `sort()` |
| `unicorn/prefer-structured-clone` | error | No JSON.parse(JSON.stringify()) |
| `unicorn/prefer-array-some` | error | `.some()` over filter-length checks |
| `import/no-default-export` | error | Named exports (framework files exempt: Next.js app/pages, configs, stories) |
| `import/max-dependencies` | warn | > 20 imports = god-module forming |
| `import/consistent-type-specifier-style` | error | Top-level `import type` |

### TypeScript

| Rule | Level | What it does |
|------|-------|-------------|
| `no-explicit-any` | error | Ban `any` |
| `ban-ts-comment` | error | No `@ts-ignore` (`@ts-expect-error` needs description) |
| `no-non-null-assertion` | warn | `!` only when provable |
| `no-inferrable-types` | error | Don't annotate the obvious |
| `consistent-type-imports` | error | `import type` for type-only imports |
| `explicit-function-return-type` | error | Declarations need return types (expressions exempt) |
| `no-dynamic-delete` | error | No `delete obj[key]` |

**Type-aware** (with `--type-aware`): `no-floating-promises`, `no-misused-promises`, `prefer-nullish-coalescing`, `switch-exhaustiveness-check` (fires even with `default` - new union members must surface), `no-for-in-array`, `prefer-optional-chain` - all error.

### React

| Rule | Level | What it does |
|------|-------|-------------|
| `rules-of-hooks` | error | Hooks at top level only |
| `exhaustive-deps` | warn | Never suppress - fix the design |
| `no-array-index-key` | error | Stable keys on lists |
| `react-in-jsx-scope` | off | Modern JSX runtime - React is never imported for JSX |
| `no-multi-comp` | warn | One component per file (SRP proxy) |
| `jsx-max-depth` | error | Max JSX depth 8 (counted below the root element) |

### Custom `nextnode` plugin

| Rule | Level | What it does |
|------|-------|-------------|
| `no-type-assertion` | error | Bans `as` casts (allows `as const`) |
| `no-enum` | error | String literal unions over `enum` (`declare enum` exempt) |
| `no-boolean-params` | error | Max 1 boolean param per function |
| `boolean-naming` | error | Booleans read as questions (`is`/`has`/`can`/`should`...), no negated names. Framework-imposed `export const` names exempt: `prerender`/`partial` (Astro), `dynamicParams`/`revalidate`/`experimental_ppr` (Next segment config). React/Hono/Express impose none |
| `no-generic-names` | warn | Bans `data`, `info`, `result`, `item`, `value`, `temp`, `stuff` |
| `no-em-dash` | error | No U+2014 in source files, incl. its HTML entity forms (`&mdash;`, `&#8212;`, `&#x2014;`) |
| `no-detached-tailwind` | error | Tailwind class lists must stay inline (`className`/`class`) or in a `cva`/`tv`/`cn`/`clsx`/`cx`/`twMerge` call - never detached in a variable, object or array. Heuristic: fires on strings with >=2 utility-looking tokens forming a majority |
| `no-use-effect` | warn | Every `useEffect` is flagged - justify or refactor (see react skill). A reviewed, legitimate effect is silenced with `// oxlint-disable-next-line nextnode/no-use-effect` - never reach for a heavier primitive just to dodge the warning |
| `max-props` | warn | Max 5 props on a PascalCase component |
| `component-filename-match` | error | `UserCard.tsx` exports `UserCard` (index files exempt) |
| `no-grab-bag-files` | error | No `utils.ts`/`helpers.ts`/`misc.ts`/`common.ts` filenames |
| `no-barrel-file` | error | No re-export barrels (`export ... from`, `export * from`) - import from the defining module. Off for `*.config.*`/rc files (preset forwarding); a package public entry opts out with an inline disable comment |
| `no-confusable-chars` | error | Bans ASCII-lookalike Unicode (curly quotes, NBSP, zero-width spaces...) that survives copy-paste invisibly; accented letters and ligatures stay allowed |
| `no-inline-type-export` | error | `export { X, type Y }` must split into `export { X }` + `export type { Y }` - export-side mirror of `import/consistent-type-specifier-style` (oxlint's port only covers imports) |
| `no-leading-semicolon` | error | No statement starting with `(`, `[` or a backtick (the `;(` ASI guard under `semi: false`) - restructure instead |
| `no-length-zero-comparison` | error | `x.length === 0` -> truthy check (`!x.length`); optional-chained `x?.length === 0` exempt (not equivalent) |
| `no-undefined-comparison` | error | No `=== undefined` / `!== undefined` - truthy check; narrowing an indexed access under `noUncheckedIndexedAccess` exempt |
| `no-nullish-ternary-return` | error | `return cond ? a : null` is a guard clause in disguise - early return instead |
| `no-empty-object-ternary` | error | `cond ? {} : {...}` -> early-return helper returning `T \| undefined`, spread its result |
| `no-sentinel-consequent` | error | The sentinel branch (`null`/`undefined`/`{}`) must be the ternary alternate, never the consequent |
| `no-ternary-spread` | error | `...(cond ? value : undefined)` -> `...(cond && value)` (spread position only) |
| `no-single-use-passthrough` | error | No single-use `const error = obj.error` re-reading a property under the same name - inline it; object destructuring exempt whatever its arity |
| `astro-props-destructuring` | error | Astro props read through `const { x } = Astro.props`, never `Astro.props.x`; passing the whole object along exempt |

### Overrides built in

- **Test/config files** (`*.config.*`, `*.test.*`, `*.spec.*`, `__tests__/`): `no-console`, `no-magic-numbers`, `max-lines`, `max-lines-per-function`, `max-nested-callbacks`, `no-empty-function`, `no-non-null-assertion` off; `no-explicit-any` warn.
- **Framework default exports** exempted: configs, rc files, Next.js `app/**` entry files, `pages/**`, `middleware.ts`, `*.stories.*`.
- **Preset-forwarding configs** (`*.config.*`, `.*rc.*`): `nextnode/no-barrel-file` off (they legitimately re-export a shared preset).
- **Astro files**: `no-unassigned-import` and `explicit-function-return-type` off.

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
			rules: { 'eslint/no-magic-numbers': 'off' },
		},
	],
})
```

## Relationship to the coding skills

The `coding` / `javascript` / `typescript` / `react` skills no longer restate what this config enforces - they carry the judgment (what to write instead, when an exception is legitimate). A lint violation is fixed by redesign, never by silencing the rule.
