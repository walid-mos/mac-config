# Cloudflare Deployment

## Adapter Setup

```ts
// astro.config.ts
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
})
```

## Version Compatibility

`@astrojs/cloudflare` v13.x tracks **Astro 6** (current). v12.x is Astro 5 (legacy). Always verify before installing:

```sh
npm view @astrojs/cloudflare@13 peerDependencies
```

## workerd Build Script

After installing `@astrojs/cloudflare`, pnpm may warn about ignored build scripts for `workerd`. Approve them for local dev preview:

```sh
pnpm approve-builds workerd
```

This is only needed for `wrangler dev` / `astro preview` locally. CI/CD builds on Cloudflare Pages don't need this.

## Environment Variables

Cloudflare Workers do NOT have `process.env`. There are two categories of env vars, accessed differently:

### Build-time vars (`import.meta.env`)

Available via `import.meta.env` because Vite inlines them during the build:

- **Astro built-ins**: `import.meta.env.SITE`, `import.meta.env.BASE_URL`, `import.meta.env.DEV`, `import.meta.env.PROD`, `import.meta.env.SSR`, `import.meta.env.MODE`
- **`PUBLIC_`-prefixed vars**: `import.meta.env.PUBLIC_ANALYTICS_ID` - available in both server and client code
- **`.env` file vars**: loaded by Vite at build time

```ts
// WORKS - Astro built-in, inlined at build time
const siteUrl = import.meta.env.SITE

// WORKS - PUBLIC_ prefix, inlined at build time
const analyticsId = import.meta.env.PUBLIC_ANALYTICS_ID
```

### Runtime vars (`locals.runtime.env`)

Custom, non-PUBLIC env vars set in the Cloudflare Pages dashboard or `wrangler.toml` are NOT inlined by Vite. They are only accessible through the Cloudflare Workers runtime binding:

```ts
// MANDATORY - access runtime env vars via locals.runtime.env
export async function POST({ locals }: APIContext): Promise<Response> {
  const { RESEND_API_KEY } = locals.runtime.env
}

// FORBIDDEN - import.meta.env.RESEND_API_KEY is undefined at runtime
const apiKey = import.meta.env.RESEND_API_KEY

// FORBIDDEN - process.env does not exist on Workers
const apiKey = process.env.RESEND_API_KEY
```

### Where to set variables

- **Local dev**: `.env` file (gitignored) - Vite loads these into `import.meta.env`. For runtime bindings, use `platformProxy: { enabled: true }` in the Cloudflare adapter config + `wrangler.toml` `[vars]`.
- **Cloudflare Pages**: Dashboard > Settings > Environment variables (available at both build time via `process.env` and runtime via `env` binding)
- **wrangler.toml**: `[vars]` section (for non-secret values)

## Static + Server Mix

With `output: 'static'`, most pages are prerendered to HTML at build time and served from Cloudflare's CDN edge cache. Routes with `prerender = false` run as Cloudflare Workers functions.

## nextnode.toml

For NextNode projects deployed via `@nextnode-solutions/infrastructure`, the project type must be `app` (not `static`) if there are server routes:

```toml
[project]
name = "my-project"
type = "app"       # required for server routes
domain = "example.fr"
```

## Global Scope Restrictions (Workers Runtime)

Cloudflare Workers forbid these operations at **module top-level** (global scope):

- `crypto.randomUUID()` / `crypto.getRandomValues()` - random value generation
- `fetch()` / `connect()` - asynchronous I/O
- `setTimeout()` / `setInterval()` - timers

Any library that calls these during initialization will crash if instantiated at module scope. Move initialization **inside the request handler**.

```ts
// FORBIDDEN - crashes on Cloudflare: "Disallowed operation called within global scope"
import { createLogger } from '@nextnode-solutions/logger'

const logger = createLogger({ prefix: '[api]' })  // ← calls crypto.randomUUID() at import time

export async function POST({ request }: APIContext) {
  logger.info('handling request')
}
```

```ts
// MANDATORY - instantiate inside the handler
import { createLogger } from '@nextnode-solutions/logger'

export async function POST({ request }: APIContext) {
  const logger = createLogger({ prefix: '[api]' })  // ← safe: inside handler
  logger.info('handling request')
}
```

This applies to any code that runs at module evaluation time - `createLogger`, HTTP clients, UUID generators, etc. If a top-level call triggers `generateRequestId`, `fetch`, or any timer, it will fail on Cloudflare.

## Cloudflare-Specific Considerations

- **No Node.js built-ins** by default. The adapter enables Node.js compatibility mode, but prefer Web APIs (`fetch`, `Request`, `Response`, `URL`, `crypto`).
- **No filesystem access** - `fs` module is unavailable. Use KV, R2, or D1 for storage.
- **In-memory state is ephemeral** - Workers can be evicted at any time. In-memory rate limiters work for basic protection but are not persistent across instances.
- **Request body** can only be read once. Do not call `request.json()` or `request.text()` twice.
