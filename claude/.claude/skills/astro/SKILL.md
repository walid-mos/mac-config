---
name: astro
description: Astro framework code standards. Use when writing or reviewing Astro components (.astro), content collections, layouts, and pages.
user-invocable: false
---

# Astro Standards

## Architecture

- Server-first by default — zero client JS unless explicitly needed
- Islands architecture: interactive components are opt-in exceptions, not the norm
- Static pages for content, server endpoints for dynamic data
- Prefer `.astro` components over framework components when no interactivity needed

## Client Directives (hydration)

- `client:load` — interactive immediately on page load (modals, nav menus)
- `client:idle` — interactive after page idle (below-fold widgets)
- `client:visible` — interactive when scrolled into viewport (counters, carousels)
- `client:only="react"` — client-render only, skip SSR (browser-only APIs)
- NEVER add `client:*` to a component that doesn't need interactivity
- Prefer `client:visible` or `client:idle` over `client:load` for performance

## Content Collections

- Define schemas in `src/content.config.ts` using Zod via `astro/zod`
- ALWAYS validate with `defineCollection` + `z.object({})` — NEVER untyped frontmatter
- Use `reference()` for cross-collection relationships
- Loaders: `glob()` for file-based, `file()` for single-file data sources
- Query with `getCollection()` / `getEntry()` — NEVER raw file reads

```typescript
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    author: reference('authors'),
  }),
});
```

## Components

- Frontmatter (`---`) for server-only logic: imports, data fetching, props
- Props typed via `Astro.props` with explicit interface
- Slots for composition: named slots for complex layouts
- NEVER put side effects in frontmatter — it runs at build/request time

## Pages & Routing

- File-based routing in `src/pages/`
- Dynamic routes: `[slug].astro` with `getStaticPaths()` for static
- API routes: `.ts` files in `src/pages/api/` returning `Response` objects
- Prefer static generation (`output: 'static'`) unless SSR is required

## Environment Variables

### How `import.meta.env` works under the hood

- Vite performs **static string replacement** at build time — `import.meta.env.X` becomes the literal value in the output JS
- `PUBLIC_` vars are **always inlined** into both client and server bundles (by design)
- In **current Astro** (without `staticImportMetaEnv`): non-public `import.meta.env.SECRET` is replaced with `process.env.SECRET` (runtime) — this is safe but will change
- With `experimental.staticImportMetaEnv` (default in **Astro 6.0**): ALL `import.meta.env` values are **inlined**, including secrets — the literal secret value ends up in the server JS bundle

### Security implications

- Inlined values are visible in Docker layers, build artifacts, source maps, and anywhere the bundle is stored
- [Vite bug #17710](https://github.com/vitejs/vite/issues/17710): referencing a non-existent env var could dump the entire `import.meta.env` object into the bundle (fixed, but illustrates the risk)
- `process.env.X` is always a **runtime lookup** — the value never appears in any bundle

### Rules for secrets

1. **ALWAYS** use `astro:env/server` with `access: "secret"` for sensitive values — this is the only future-proof pattern
2. **NEVER** use `import.meta.env.SECRET_X` for sensitive data — safe today, **broken in Astro 6**
3. **NEVER** use raw `process.env` in Astro — Vite replaces `process.env.X` with `({}).X` in some contexts, and `.env` files are not auto-loaded into `process.env`
4. `PUBLIC_` vars are fine via `import.meta.env.PUBLIC_X` — they are meant to be public

### Canonical pattern for secrets

```typescript
// astro.config.mjs
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      API_SECRET: envField.string({ context: "server", access: "secret" }),
      PORT: envField.number({ context: "server", access: "public", default: 4321 }),
    },
    validateSecrets: true, // validate at startup, useful in CI
  },
});
```

```typescript
// src/lib/my-service.ts
import { API_SECRET } from "astro:env/server";
// API_SECRET is: never in client bundle, never inlined, always runtime, type-safe, validated
```

### Quick reference

| Pattern | Safe for secrets? | Future-proof? |
|---|---|---|
| `import { X } from "astro:env/server"` (access: "secret") | Yes | Yes |
| `import.meta.env.SECRET` (current Astro default) | Yes (today) | **No** (inlined in Astro 6) |
| `process.env.SECRET` | Yes (runtime) | Fragile (Vite may rewrite) |
| `import.meta.env.PUBLIC_X` | Public only | Yes |

## Styling

- Scoped `<style>` blocks in `.astro` files by default
- Tailwind for utility classes when configured
- `is:global` only when scoped styles genuinely can't work
- CSS custom properties for theming across components
