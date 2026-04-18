# Routing, Pages & Layouts

## File-Based Routing

Files in `src/pages/` become routes automatically:

```
src/pages/index.astro        -> /
src/pages/about.astro        -> /about
src/pages/about/index.astro  -> /about
src/pages/blog/first.md      -> /blog/first
```

Supported page file types: `.astro`, `.md`, `.mdx`, `.html`, `.ts`/`.js` (API endpoints).

## Dynamic Routes

### Named parameters

```astro
---
// src/pages/blog/[slug].astro
export function getStaticPaths() {
  return [
    { params: { slug: 'first-post' } },
    { params: { slug: 'second-post' } },
  ]
}

const { slug } = Astro.params
---
<h1>{slug}</h1>
```

### Rest parameters

Catch-all routes with `[...path]`:

```astro
---
// src/pages/blog/[...slug].astro
// Matches /blog, /blog/a, /blog/a/b, etc.
export function getStaticPaths() {
  return [
    { params: { slug: undefined } },  // /blog
    { params: { slug: 'category/post' } },  // /blog/category/post
  ]
}
---
```

### `getStaticPaths` with props

Pass data to the page via `props`:

```astro
---
export function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }))
}

const { post } = Astro.props
---
```

`getStaticPaths` is required for dynamic routes in `static` output mode. In `server` mode, dynamic params come from `Astro.params` directly.

## Layouts

Layouts are regular Astro components that wrap page content via `<slot />`:

```astro
---
// src/layouts/Base.astro
interface Props {
  title: string
  description?: string
}

const { title, description = '' } = Astro.props
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

Usage in a page:

```astro
---
// src/pages/index.astro
import Base from '../layouts/Base.astro'
---
<Base title="Home" description="Welcome">
  <h1>Hello</h1>
</Base>
```

### Markdown layout

Markdown pages use the `layout` frontmatter property:

```md
---
layout: ../layouts/BlogPost.astro
title: My First Post
---

Content here.
```

The layout receives all frontmatter as `Astro.props.frontmatter` and the content via `<slot />`.

## Middleware

Define middleware in `src/middleware.ts`. Runs on every route before the page renders.

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  // Before the route handler
  const startTime = performance.now()

  // Set shared data via locals
  context.locals.requestId = crypto.randomUUID()

  const response = await next()

  // After the route handler
  const duration = performance.now() - startTime
  response.headers.set('X-Response-Time', `${duration.toFixed(0)}ms`)

  return response
})
```

### Middleware chaining with `sequence`

```ts
import { defineMiddleware, sequence } from 'astro:middleware'

const auth = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('session')?.value
  if (token) {
    context.locals.user = await validateToken(token)
  }
  return next()
})

const logging = defineMiddleware(async (context, next) => {
  console.log(`${context.request.method} ${context.url.pathname}`)
  return next()
})

export const onRequest = sequence(auth, logging)
```

### Typing `locals`

Declare `App.Locals` in `src/env.d.ts`:

```ts
/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    requestId: string
    user?: { id: string; email: string }
  }
}
```

## Redirects

### In config

```ts
// astro.config.ts
export default defineConfig({
  redirects: {
    '/old-page': '/new-page',
    '/blog/[...slug]': '/articles/[...slug]',
  },
})
```

### Programmatic

```ts
// In an API route or page frontmatter
return Astro.redirect('/login', 302)
```

## 404 Page

Create `src/pages/404.astro` for a custom 404 page. It is statically generated in all output modes.
