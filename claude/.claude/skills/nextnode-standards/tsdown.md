# tsdown - Bundler config

**Export path**: `@nextnode-solutions/standards/tsdown`

Shared base config for [tsdown](https://tsdown.dev), used by all publishable NextNode packages (logger, email-manager, etc.) to produce ESM bundles + DTS declarations.

## What the base provides

```js
{
  format: ['esm'],
  fixedExtension: false,
  target: 'es2023',
  treeshake: true,
  clean: true,
}
```

- `format: ['esm']` - NextNode is ESM-only.
- `fixedExtension: false` - output `.js`/`.d.ts` (not tsdown's default `.mjs`/`.d.mts`) so `package.json` exports stay clean. Requires `"type": "module"` in the consumer.
- `target: 'es2023'` - matches the TypeScript library tsconfig.
- `treeshake: true`, `clean: true` - tsdown defaults made explicit.

## Usage

```ts
// tsdown.config.ts
import baseConfig from '@nextnode-solutions/standards/tsdown'
import { defineConfig } from 'tsdown'

export default defineConfig({
  ...baseConfig,
  entry: { index: 'src/index.ts' },
  dts: true,
})
```

Always spread `baseConfig` first, then add per-package fields:
- `entry` - required, maps to `package.json` exports
- `dts: true` - required for publishable libs
- `minify`, `sourcemap`, `outDir` - optional overrides

## Multi-entry example

```ts
export default defineConfig({
  ...baseConfig,
  entry: {
    logger: 'src/logger.ts',
    testing: 'src/testing/test-utils.ts',
    'transports/http': 'src/transports/http.ts',
  },
  dts: true,
})
```

Produces `dist/logger.js`, `dist/testing.js`, `dist/transports/http.js` with matching `.d.ts` files. Each key matches an export in `package.json`.

## Non-published packages (CLIs)

If the package is consumed from source (not npm), set `dts: false` to skip declaration generation:

```ts
export default defineConfig({
  ...baseConfig,
  entry: 'src/index.ts',
  dts: false,
})
```

## package.json setup

```jsonc
{
  "type": "module",                      // required for fixedExtension: false
  "scripts": {
    "build": "tsdown"
  },
  "devDependencies": {
    "@nextnode-solutions/standards": "workspace:*",
    "tsdown": "<latest-stable>"
  }
}
```

## Why tsdown over tsup

tsup is in maintenance mode and has an unfixed bug ([#1388](https://github.com/egoist/tsup/issues/1388)) where its DTS plugin injects `baseUrl: "."`, triggering TS5101 deprecation errors on TypeScript 6+. tsdown (same author) uses Rolldown + Oxc, is actively maintained, and avoids the issue. API is nearly drop-in compatible.

## Gotchas

- **`splitting: false` is not supported** - code splitting is always on in tsdown. With single-entry packages this is a no-op (nothing to split).
- **`external` is deprecated** - use `deps: { neverBundle: [...] }` if you need to force-externalize, but peer dependencies are auto-externalized so usually you don't need to specify anything.
- **`fixedExtension: false` requires `"type": "module"`** - if your `package.json` doesn't have it, tsdown will refuse and fall back to `.mjs`.
