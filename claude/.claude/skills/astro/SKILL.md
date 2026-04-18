---
name: astro
description: >-
  Astro 5 framework rules, patterns, and best practices. Load whenever working
  on an Astro project (astro.config.ts, .astro files, src/pages/, src/content/).
  Covers components, routing, content collections, rendering modes, islands
  architecture, styling, API routes, and deployment. Must be used alongside
  /typescript and /coding.
user-invocable: true
synced-at: 3fbec5f3da69a242a9c400e13193e6dd593b8296
---

# Astro 5 — Mandatory Rules

These rules apply to ALL Astro code you write or modify. Astro 5 introduced breaking changes from Astro 4 — many patterns from older documentation are wrong.

---

## RULE 1 — NO `hybrid` OUTPUT MODE

Astro 5 removed the `hybrid` output mode. There are only two modes:

- `output: 'static'` (default) — all pages prerendered at build time
- `output: 'server'` — all pages rendered on demand

To mix static and server routes, add an adapter and use per-route `prerender` exports. Do NOT set `output: 'hybrid'`.

See [rendering.md](rendering.md) for full details and decision table.

---

## RULE 2 — ADAPTER VERSION COMPATIBILITY

Always check adapter peer dependencies before installing. Major adapter versions track Astro major versions:

| Astro version | `@astrojs/cloudflare` | `@astrojs/node` | `@astrojs/vercel` |
|---|---|---|---|
| Astro 5 | ^12.x | ^10.x | ^8.x |
| Astro 6 | ^13.x | ^11.x | ^9.x |

Before installing: `npm view @astrojs/<adapter>@<major> peerDependencies`

---

## RULE 3 — SCOPE FRAMEWORK INTEGRATIONS

When adding React/Vue/Svelte for a limited use case (e.g. email templates), always scope the integration with `include` to avoid processing unrelated files:

```ts
// MANDATORY — scoped
integrations: [react({ include: ['**/emails/**'] })]

// FORBIDDEN — unscoped when only used in a subdirectory
integrations: [react()]
```

---

## RULE 4 — API ROUTES USE NAMED HTTP EXPORTS

Server endpoints export named functions matching HTTP methods. Always set `prerender = false` in static output mode.

```ts
// src/pages/api/contact.ts
export const prerender = false

export async function POST({ request, clientAddress }: APIContext): Promise<Response> {
  // ...
}
```

See [api-routes.md](api-routes.md) for validation patterns, JSON responses, and rate limiting.

---

## RULE 5 — ENVIRONMENT VARIABLES

`process.env` is NOT available in all runtimes (Cloudflare Workers, Deno). Access env vars differently depending on context:

- **Astro built-ins**: `import.meta.env.SITE`, `import.meta.env.BASE_URL` — always available (inlined at build time)
- **Public (client-safe)**: prefix with `PUBLIC_` — `import.meta.env.PUBLIC_ANALYTICS_ID` (inlined at build time)
- **Private runtime vars on Cloudflare**: use `locals.runtime.env.RESEND_API_KEY` in API routes — `import.meta.env.RESEND_API_KEY` is **undefined** at runtime because Vite does not inline non-PUBLIC custom vars

See [cloudflare.md](cloudflare.md) for the full breakdown of build-time vs runtime env vars.

---

## RULE 6 — CONTENT COLLECTIONS USE CONTENT LAYER API

Astro 5 uses the Content Layer API with explicit loaders. Define collections in `src/content.config.ts` with `glob()` or `file()` loaders and Zod schemas.

Import `z` from `astro/zod` — never from `zod` directly.

```ts
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'  // NOT from 'zod'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({ title: z.string() }),
})
```

Use `getCollection()` and `getEntry()` from `astro:content` to query. Use `render()` to compile Markdown/MDX to a `<Content />` component. Do NOT use `import.meta.glob()` for content that belongs in a collection.

See [content-collections.md](content-collections.md) for loaders, schemas, rendering, and page generation.

---

## RULE 7 — SCRIPTS IN `.astro` FILES

Client-side scripts in `.astro` files are bundled and deduplicated by default. Import TypeScript modules directly:

```astro
<script>
  import { initContactForm } from '@/scripts/contact-form.ts'
  initContactForm()
</script>
```

`is:inline` disables bundling — only use it for raw third-party snippets. `define:vars` also makes scripts inline.

---

## RULE 8 — ASTRO CHECK IS MANDATORY

`oxlint` and `tsc` do NOT catch errors in `.astro` files. Always run `astro check` as part of the Definition of Done.

---

## RULE 9 — MINIMIZE CLIENT-SIDE JAVASCRIPT

Astro ships zero JS by default. Keep it that way unless interactivity is required:

- Do NOT add `client:*` directives to components that work as static HTML.
- Prefer `client:visible` or `client:idle` over `client:load` to defer hydration.
- Use native HTML for interactivity where possible (`<details>`, `<dialog>`, CSS `:hover`).
- Only framework components (React, Vue, Svelte) need `client:*` — Astro components are always static.

See [islands.md](islands.md) for all client directives, `server:defer`, scripts, and View Transitions.

---

## RULE 10 — TYPE COMPONENT PROPS

Always define a `Props` interface and destructure `Astro.props`:

```astro
---
interface Props {
  title: string
  description?: string
}

const { title, description } = Astro.props
---
```

Never reference `Astro.props.x` in the template. Never use `any` for props.

See [components.md](components.md) for slots, template expressions, `class:list`, `set:html`, `define:vars`.

---

## RULE 11 — PREFER SCOPED STYLES

`<style>` in `.astro` files is scoped by default. Keep it that way:

- Use scoped `<style>` for component styles.
- Use `is:global` or `:global()` sparingly (resets, fonts, CSS custom properties).
- Import CSS in frontmatter (not `<link>`) for bundling and optimization.
- Use `class:list` for conditional classes, not string concatenation.
- Use `define:vars` to pass server values to CSS.

See [styling.md](styling.md) for scoped styles, global styles, CSS modules, and Tailwind.

---

## RULE 12 — LAYOUTS WRAP PAGES, NOT COMPONENTS

Layouts are Astro components with `<slot />` that wrap entire pages. Keep them in `src/layouts/`. Pages reference layouts by importing them, Markdown pages use the `layout` frontmatter property.

See [routing.md](routing.md) for file-based routing, dynamic routes, layouts, middleware, and redirects.

---

## RULE 13 — NEVER USE `set:html` WITH UNTRUSTED INPUT

`set:html` injects raw HTML (equivalent to `innerHTML`). Using it with user input or external data is an XSS vulnerability. Use `set:text` for safe text rendering.

```astro
<!-- FORBIDDEN — XSS risk -->
<div set:html={userInput} />

<!-- MANDATORY — safe -->
<div set:text={userInput} />
```

---

## RULE 14 — USE `getStaticPaths` FOR DYNAMIC ROUTES IN STATIC MODE

Dynamic routes (`[slug].astro`, `[...path].astro`) in `output: 'static'` require `getStaticPaths()` to define all possible paths at build time. Missing this causes build errors.

In `output: 'server'`, dynamic params come from `Astro.params` directly — no `getStaticPaths` needed.

---

## Quick Reference

| Topic | File |
|---|---|
| Component structure, props, slots, directives | [components.md](components.md) |
| Content Layer API, loaders, schemas, rendering | [content-collections.md](content-collections.md) |
| File-based routing, layouts, middleware, redirects | [routing.md](routing.md) |
| Client directives, hydration, scripts, View Transitions | [islands.md](islands.md) |
| Scoped styles, global CSS, class:list, define:vars | [styling.md](styling.md) |
| Rendering modes, prerender, adapters | [rendering.md](rendering.md) |
| API routes, endpoints, JSON responses | [api-routes.md](api-routes.md) |
| Cloudflare deployment specifics | [cloudflare.md](cloudflare.md) |
