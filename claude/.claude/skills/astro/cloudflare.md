# Cloudflare Deployment

`@astrojs/cloudflare` v13.x tracks Astro 6. For project-level deploy config (nextnode.toml, CI/CD), see `/nextnode-deploy`.

## Environment variables

Cloudflare Workers do NOT expose `process.env`. Two categories with different access:

### Build-time (`import.meta.env`)

Inlined by Vite at build time. Includes Astro built-ins (`SITE`, `BASE_URL`, `DEV`, `PROD`, `MODE`), `PUBLIC_`-prefixed vars, and `.env` file values.

```ts
const siteUrl = import.meta.env.SITE
const analyticsId = import.meta.env.PUBLIC_ANALYTICS_ID
```

### Runtime secrets and Cloudflare bindings

Two categories, two paths — pick the right one:

| What | Path | Why |
|---|---|---|
| Plain string secrets (`RESEND_API_KEY`, `API_TOKEN`, …) | `astro:env/server` — `import { X } from 'astro:env/server'` or `getSecret('X')` | Cross-adapter, type-safe, validated at startup. **MANDATORY for plain vars.** |
| Cloudflare-specific bindings (KV, D1, R2, AI, Queues, Durable Objects) | `locals.runtime.env.MY_KV` | These are object handles, not strings — `astro:env` cannot represent them. **MANDATORY for CF bindings.** |

```ts
// MANDATORY — plain secret: use astro:env
import { RESEND_API_KEY } from 'astro:env/server'

export async function POST({ request }: APIContext): Promise<Response> {
  // use RESEND_API_KEY directly
}

// MANDATORY — Cloudflare binding (KV / D1 / R2 / etc.): use locals.runtime.env
export async function GET({ locals }: APIContext): Promise<Response> {
  const { MY_KV } = locals.runtime.env
  const value = await MY_KV.get('key')
  // ...
}

// FORBIDDEN - undefined at runtime
const apiKey = import.meta.env.RESEND_API_KEY

// FORBIDDEN - process.env does not exist on Workers
const apiKey = process.env.RESEND_API_KEY
```

Set them in:
- **Local dev**: `.env` for build-time vars and `astro:env` secrets; `wrangler.toml` `[vars]` + `platformProxy: { enabled: true }` for runtime bindings.
- **Cloudflare Pages**: Dashboard → Settings → Environment variables.

## Global scope restrictions (Workers runtime)

Workers forbid these operations at **module top-level**:

- `crypto.randomUUID()` / `crypto.getRandomValues()`
- `fetch()` / `connect()` (async I/O)
- `setTimeout()` / `setInterval()`

Any library that calls these during init crashes at import time. Move instantiation **inside the request handler**.

```ts
// FORBIDDEN - "Disallowed operation called within global scope"
import { createLogger } from '@nextnode-solutions/logger'

const logger = createLogger({ prefix: '[api]' })  // calls crypto.randomUUID()

// MANDATORY
import { createLogger } from '@nextnode-solutions/logger'

export async function POST({ request }: APIContext) {
  const logger = createLogger({ prefix: '[api]' })
  logger.info('handling request')
}
```

## Other constraints

- **No `fs`**. Use KV, R2, or D1 for storage.
- **In-memory state is ephemeral** — Workers evict at any time. Rate limiters in memory don't persist across instances.
- **Request body reads once** — calling `request.json()` or `request.text()` twice throws.
- Prefer Web APIs (`fetch`, `Request`, `Response`, `URL`, `crypto`) over Node built-ins even with Node-compat mode on.
