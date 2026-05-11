---
name: astro
description: >-
  Astro 6 framework rules, patterns, and best practices (latest major; 6.1.8
  as of 2026-04-22). Load whenever working on an Astro project
  (astro.config.ts, .astro files, src/pages/, src/content/). Covers
  components, routing, content collections, rendering modes, islands
  architecture, styling, API routes, env vars, and deployment. Must be used
  alongside /typescript and /coding.
user-invocable: true
synced-at: 3fbec5f3da69a242a9c400e13193e6dd593b8296
---

# Astro 6 - Mandatory Rules

These rules apply to ALL Astro code you write or modify. This skill targets **Astro 6** (latest major - tracks the latest release, not legacy lines). Most rules also apply unchanged to Astro 5, but assume 6 unless a rule says otherwise. When starting a new Astro project, install the latest major - never default to 5 just because tutorials still show it.

**Astro 6 key breaking changes from 5** (check these when upgrading):
- Minimum Node ≥ 22.12 (Node 18 / 20 dropped).
- `import.meta.env` no longer auto-transforms to `process.env` - reference `process.env.X` explicitly when you need it.
- Stabilized experimental flags - remove these from `experimental` if present: `csp`, `fonts`, `liveContentCollections`, `preserveScriptOrder`, `staticImportMetaEnv`, `headingIdCompat`, `failOnPrerenderConflict`.
- Adapter major bumps: `@astrojs/node` v11, `@astrojs/cloudflare` v13, `@astrojs/vercel` v9.
- `astro:build:setup` hook is now called once with all environments - remove the `target` parameter, use `vite.environments` instead.
- `setAdapter` API: drop the deprecated `exports` and `args`, set `entrypointResolution: 'auto'`.

---

## RULE 1 - NO `hybrid` OUTPUT MODE

Astro 5 removed the `hybrid` output mode, and it stays gone in Astro 6. There are only two modes:

- `output: 'static'` (default) - all pages prerendered at build time
- `output: 'server'` - all pages rendered on demand

To mix static and server routes, add an adapter and use per-route `prerender` exports. Do NOT set `output: 'hybrid'`.

See [rendering.md](rendering.md) for full details and decision table.

---

## RULE 2 - ADAPTER VERSION COMPATIBILITY

Always check adapter peer dependencies before installing. Major adapter versions track Astro major versions. Default to the row matching the **Astro major you're installing** - for a new project, that's Astro 6:

| Astro version | `@astrojs/cloudflare` | `@astrojs/node` | `@astrojs/vercel` |
|---|---|---|---|
| Astro 6 (current) | ^13.x | ^11.x | ^9.x |
| Astro 5 (legacy) | ^12.x | ^10.x | ^8.x |

Before installing: `npm view @astrojs/<adapter>@<major> peerDependencies`

Before starting a new project: `npm view astro version` - always install the current major, not what tutorials show.

---

## RULE 3 - SCOPE FRAMEWORK INTEGRATIONS

When adding React/Vue/Svelte for a limited use case (e.g. email templates), always scope the integration with `include` to avoid processing unrelated files:

```ts
// MANDATORY - scoped
integrations: [react({ include: ['**/emails/**'] })]

// FORBIDDEN - unscoped when only used in a subdirectory
integrations: [react()]
```

---

## RULE 4 - API ROUTES USE NAMED HTTP EXPORTS

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

## RULE 5 - ENVIRONMENT VARIABLES - USE `astro:env`

Runtime env vars go through `astro:env/server`. Works on all adapters (Node, Cloudflare, Vercel, Netlify). Same API in Astro 5 and 6.

**Never** read runtime secrets via `process.env[name]` (not populated from `.env` on the server) or `import.meta.env[varName]` with bracket access (Vite only replaces literal accesses).

**Declare the schema** in `astro.config.ts` (extract to `src/config/env.schema.ts` once it exceeds 2-3 entries):

```ts
// src/config/env.schema.ts
import { envField } from 'astro/config'

export const envSchema = {
  API_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
} as const
```

```ts
// astro.config.ts
import { envSchema } from './src/config/env.schema.ts'

export default defineConfig({
  env: { schema: envSchema },
})
```

**Read at runtime**:

```ts
// Dynamic lookup (by name) - for wrapper helpers
import { getSecret } from 'astro:env/server'
const token = getSecret('API_TOKEN')

// Direct named import - when the name is known statically
import { API_TOKEN } from 'astro:env/server'
```

**`optional: true`** lets missing vars surface as per-page errors instead of crashing the whole server at startup. Use it for dashboards / internal tools that should render a "missing config" UI state.

**`access: 'secret'`** keeps the value out of client bundles. Mandatory for credentials.

**Always-available build-time vars** (no schema needed): `import.meta.env.SITE`, `import.meta.env.BASE_URL`, `import.meta.env.DEV|PROD|SSR|MODE`. **Public vars** (`PUBLIC_*`) stay inlined at build time and work in both server and client.

See [env.md](env.md) for full `envField` API, `access`/`context` matrix, and adapter specifics (Node `.env` hot-reload caveat, Cloudflare bindings).

---

## RULE 6 - CONTENT COLLECTIONS USE CONTENT LAYER API

Astro 6 (and 5) use the Content Layer API with explicit loaders. Define collections in `src/content.config.ts` with `glob()` or `file()` loaders and Zod schemas. The pre-5 legacy collection format is gone.

Import `z` from `astro/zod` - never from `zod` directly.

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

## RULE 7 - SCRIPTS IN `.astro` FILES

Client-side scripts in `.astro` files are bundled and deduplicated by default. Import TypeScript modules directly:

```astro
<script>
  import { initContactForm } from '@/scripts/contact-form.ts'
  initContactForm()
</script>
```

`is:inline` disables bundling - only use it for raw third-party snippets. `define:vars` also makes scripts inline.

---

## RULE 8 - ASTRO CHECK IS MANDATORY

`oxlint` and `tsc` do NOT catch errors in `.astro` files. Always run `astro check` as part of the Definition of Done.

---

## RULE 9 - MINIMIZE CLIENT-SIDE JAVASCRIPT

Astro ships zero JS by default. Keep it that way unless interactivity is required:

- Do NOT add `client:*` directives to components that work as static HTML.
- Prefer `client:visible` or `client:idle` over `client:load` to defer hydration.
- Use native HTML for interactivity where possible (`<details>`, `<dialog>`, CSS `:hover`).
- Only framework components (React, Vue, Svelte) need `client:*` - Astro components are always static.

See [islands.md](islands.md) for all client directives, `server:defer`, scripts, and View Transitions.

---

## RULE 10 - TYPE COMPONENT PROPS

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

## RULE 11 - PREFER SCOPED STYLES

`<style>` in `.astro` files is scoped by default. Keep it that way:

- Use scoped `<style>` for component styles.
- Use `is:global` or `:global()` sparingly (resets, fonts, CSS custom properties).
- Import CSS in frontmatter (not `<link>`) for bundling and optimization.
- Use `class:list` for conditional classes, not string concatenation.
- Use `define:vars` to pass server values to CSS.

See [styling.md](styling.md) for scoped styles, global styles, CSS modules, and Tailwind.

---

## RULE 12 - LAYOUTS WRAP PAGES, NOT COMPONENTS

Layouts are Astro components with `<slot />` that wrap entire pages. Keep them in `src/layouts/`. Pages reference layouts by importing them, Markdown pages use the `layout` frontmatter property.

See [routing.md](routing.md) for file-based routing, dynamic routes, layouts, middleware, and redirects.

---

## RULE 13 - NEVER USE `set:html` WITH UNTRUSTED INPUT

`set:html` injects raw HTML (equivalent to `innerHTML`). Using it with user input or external data is an XSS vulnerability. Use `set:text` for safe text rendering.

```astro
<!-- FORBIDDEN - XSS risk -->
<div set:html={userInput} />

<!-- MANDATORY - safe -->
<div set:text={userInput} />
```

---

## RULE 14 - USE `getStaticPaths` FOR DYNAMIC ROUTES IN STATIC MODE

Dynamic routes (`[slug].astro`, `[...path].astro`) in `output: 'static'` require `getStaticPaths()` to define all possible paths at build time. Missing this causes build errors.

In `output: 'server'`, dynamic params come from `Astro.params` directly - no `getStaticPaths` needed.

---

## RULE 15 - UNION TYPES IN FRONTMATTER STAY ON ONE LINE

Write TypeScript union types in `.astro` frontmatter on a **single line**. The esbuild-based TS-strip pass used by Astro 5 and 6 mishandles multi-line unions with leading pipes - it strips the `type X =` line but leaks the continuation `| 'x'` lines into compiled output, producing a runtime `Unexpected "|"` esbuild error.

```astro
---
// FORBIDDEN - breaks at runtime with "Unexpected '|'"
export type ButtonVariant =
  | 'default'
  | 'accent'
  | 'muted'

type Tag =
  | 'a'
  | 'p'
  | 'span'

// MANDATORY - single line
export type ButtonVariant = 'default' | 'accent' | 'muted'
type Tag = 'a' | 'p' | 'span'
---
```

This applies to every union in the frontmatter fence (`---`), including `type`, `export type`, and inline types inside `interface Props`. Prettier's default multi-line union formatting must be overridden for `.astro` files - either keep unions short enough to fit one line, or suppress the formatter on that line. Long unions also survive as a single line: do not split them for readability at the cost of breaking the build.

`.ts`/`.tsx` files outside `.astro` are unaffected - this is specifically the Astro compiler's frontmatter extraction pipeline.

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
| Env vars, `astro:env`, `getSecret`, `envField`, Astro 6 notes | [env.md](env.md) |
| Cloudflare deployment specifics | [cloudflare.md](cloudflare.md) |
