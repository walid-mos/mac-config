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

## Styling

- Scoped `<style>` blocks in `.astro` files by default
- Tailwind for utility classes when configured
- `is:global` only when scoped styles genuinely can't work
- CSS custom properties for theming across components
