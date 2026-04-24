# Environment Variables — `astro:env`

Runtime env vars in Astro go through `astro:env/server`. This works across all adapters (Node, Cloudflare, Vercel, Netlify). Same API in Astro 5 and 6 — safe to use regardless of which major the project is on.

Never read runtime secrets via `process.env[name]` or `import.meta.env[name]` with dynamic bracket access:

- **`process.env`** is NOT populated from `.env` files for Astro server code. Vite loads `.env` into its own env store, not `process.env`. Result: `process.env.API_TOKEN` returns `undefined` even with a correctly-named `.env` entry.
- **`import.meta.env[varName]`** (dynamic bracket) is NOT statically replaceable by Vite. Only literal accesses (`import.meta.env.API_TOKEN`) get inlined at build time.

## Declare the schema

Inline when trivial, extracted when the schema grows beyond 2-3 entries.

**Small schema — inline**:

```ts
// astro.config.ts
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  env: {
    schema: {
      API_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      DEBUG: envField.boolean({ context: 'server', access: 'public', optional: true, default: false }),
    },
  },
})
```

**Larger schema — extract to its own file**:

```ts
// src/config/env.schema.ts
import { envField } from 'astro/config'

export const envSchema = {
  API_TOKEN: envField.string({
    context: 'server',
    access: 'secret',
    optional: true,
  }),
  ACCOUNT_ID: envField.string({
    context: 'server',
    access: 'secret',
    optional: true,
  }),
  // ...
} as const
```

```ts
// astro.config.ts
import { defineConfig } from 'astro/config'
import { envSchema } from './src/config/env.schema.ts'

export default defineConfig({
  env: { schema: envSchema },
})
```

`envField` is a plain factory returning config objects, and `env.schema` takes any object — extraction is free and keeps `astro.config.ts` tight.

## Read at runtime

Two access patterns depending on whether the name is known statically:

```ts
// Direct named import — for single-purpose code paths (preferred when possible)
import { API_TOKEN } from 'astro:env/server'

// Dynamic lookup by name — for wrapper helpers like `getEnv(name)` / `requireEnv(name)`
import { getSecret } from 'astro:env/server'
const token = getSecret('API_TOKEN')
```

Both are type-safe: generated types come from the `env.schema` declaration. Run `astro sync` after editing the schema so `astro:env/server` types regenerate.

## `optional: true` — graceful degradation

By default, Astro throws at server startup if a non-optional env var is missing, and the server refuses to boot. Use `optional: true` when the app must render a "missing config" UI state instead:

```ts
// MANDATORY for required-at-boundary vars you want to surface as per-page errors
API_TOKEN: envField.string({
  context: 'server',
  access: 'secret',
  optional: true,
})
```

Then wrap reads with your own `requireEnv()` helper that throws a typed error your page / error boundary can catch:

```ts
import { getSecret } from 'astro:env/server'

export class MissingEnvError extends Error {
  constructor(public readonly varName: string) {
    super(`Missing required env var: ${varName}`)
    this.name = 'MissingEnvError'
  }
}

export const requireEnv = (name: string): string => {
  const value = getSecret(name)
  if (!value) throw new MissingEnvError(name)
  return value
}
```

This is the idiomatic pattern for dashboards / internal tools where a missing secret should render a "configure me" page, not 500.

## `access` — `secret` vs `public`

| `access` | `context: 'server'` | `context: 'client'` |
|---|---|---|
| `'secret'` | Server-only. Never reaches client bundles. Use for credentials. | Not allowed. |
| `'public'` | Inlined at build time, available via direct import. Safe to surface server-side but not secret. | Inlined into client bundles. Use for analytics IDs, public API URLs. |

## Always-available built-ins

No schema declaration needed — Astro inlines these at build time:

- `import.meta.env.SITE`
- `import.meta.env.BASE_URL`
- `import.meta.env.DEV`, `import.meta.env.PROD`, `import.meta.env.SSR`, `import.meta.env.MODE`

## Adapter specifics

### Node adapter

- `.env` files at the project root are loaded by Vite and exposed via `astro:env/server`.
- Vite does **NOT** hot-reload `.env` changes — restart the dev server after editing `.env`.
- In production (`node dist/server/entry.mjs`), env vars come from the process environment (`docker run -e`, systemd `Environment=`, etc.). `astro:env/server` reads from both `.env` (dev) and `process.env` (prod) transparently.

### Cloudflare adapter

- `.env` works in dev (via Wrangler + Miniflare).
- In production, bindings are injected via `locals.runtime.env` in API routes — see [cloudflare.md](cloudflare.md).
- `astro:env/server` + `getSecret()` is the cross-adapter recommendation; `locals.runtime.env` remains for Cloudflare-specific bindings (KV, D1, R2, etc.) that aren't plain strings.

## `envField` types

| Factory | Produces |
|---|---|
| `envField.string({ ... })` | string, with optional `min`, `max`, `url`, `startsWith`, `endsWith`, `includes` Zod-style constraints |
| `envField.number({ ... })` | number, with optional `min`, `max`, `int` |
| `envField.boolean({ ... })` | boolean |
| `envField.enum({ values, ... })` | string union — `values: ['a', 'b', 'c']` is required |

All accept `context: 'server' \| 'client'`, `access: 'secret' \| 'public'`, `optional?: boolean`, `default?: <matching type>`.

## Version note

The `astro:env` API is **unchanged between Astro 5 and 6** — same `envField`, `getSecret`, schema shape. Code written against this skill ports cleanly between majors. For the rest of the Astro 6 breaking-change list, see the intro of [SKILL.md](SKILL.md).
