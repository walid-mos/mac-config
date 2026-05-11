# Rendering Modes in Astro 5

## The Two Output Modes

Astro 5 has exactly two output modes. The `hybrid` mode from Astro 4 was removed.

### `output: 'static'` (default)

All pages prerendered at build time. Add an adapter to enable per-route server rendering.

```ts
// astro.config.ts
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  output: 'static',          // default, can be omitted
  adapter: cloudflare(),      // required for prerender = false routes
})
```

Opt specific routes into on-demand rendering:

```ts
// src/pages/api/contact.ts
export const prerender = false  // this route runs on the server

export async function POST({ request }: APIContext) {
  // server-rendered
}
```

```astro
---
// src/pages/dashboard.astro
export const prerender = false
---
<!-- server-rendered page -->
```

All other pages remain static. This is the preferred mode for content sites with a few server routes.

### `output: 'server'`

All pages rendered on demand by default. Opt specific routes into static prerendering:

```ts
// src/pages/about.astro
export const prerender = true  // this page is static
```

Use this when most routes need server rendering (authenticated apps, dynamic dashboards).

## Decision Table

| Scenario | Output mode | Per-route export |
|---|---|---|
| Fully static site, no server routes | `static` (no adapter needed) | none |
| Static site + a few API routes | `static` + adapter | `prerender = false` on API routes |
| Mostly server, some static pages | `server` + adapter | `prerender = true` on static pages |
| Fully dynamic app | `server` + adapter | none |

## Common Mistake - `output: 'hybrid'`

```ts
// FORBIDDEN - hybrid was removed in Astro 5
export default defineConfig({
  output: 'hybrid',
  adapter: cloudflare(),
})

// MANDATORY - use static + per-route prerender = false
export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
})
```

## Adapter Requirement

`export const prerender = false` requires an adapter. Without one, Astro will error at build time. Always install and configure an adapter before using on-demand routes.
