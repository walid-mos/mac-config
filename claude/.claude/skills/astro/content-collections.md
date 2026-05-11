# Content Collections

## Overview

Content collections are Astro's type-safe way to manage structured content (blog posts, products, authors, etc.). Defined in `src/content.config.ts`, they use the **Content Layer API** introduced in Astro 5.

## Defining Collections

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content'
import { glob, file } from 'astro/loaders'
import { z } from 'astro/zod'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
})

const authors = defineCollection({
  loader: file('src/data/authors.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    bio: z.string(),
  }),
})

export const collections = { blog, authors }
```

## Loaders

| Loader | Use case | Source |
|---|---|---|
| `glob({ pattern, base })` | Markdown/MDX files in a directory | `astro/loaders` |
| `file(path)` | Single JSON or YAML data file | `astro/loaders` |
| Custom loader | External CMS, API, database | Write your own |

## Import Zod from `astro/zod`

Always import `z` from `astro/zod`, not from `zod` directly. Astro bundles its own Zod version to avoid version mismatches:

```ts
// MANDATORY
import { z } from 'astro/zod'

// FORBIDDEN - version conflict risk
import { z } from 'zod'
```

## Querying Collections

### `getCollection()` - all entries

```astro
---
import { getCollection } from 'astro:content'

const posts = await getCollection('blog')

// With filter
const published = await getCollection('blog', ({ data }) => !data.draft)
---
```

### `getEntry()` - single entry by ID

```astro
---
import { getEntry } from 'astro:content'

const post = await getEntry('blog', 'my-first-post')
---
```

### Entry shape

Each entry has:

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (filename without extension for glob) |
| `data` | inferred from schema | Validated frontmatter / data fields |
| `body` | `string \| undefined` | Raw content body (Markdown/MDX only) |

## Rendering Content

Use the `render()` function to compile Markdown/MDX to a `<Content />` component:

```astro
---
import { getEntry, render } from 'astro:content'

const post = await getEntry('blog', 'my-first-post')
const { Content, headings } = await render(post)
---
<article>
  <h1>{post.data.title}</h1>
  <time>{post.data.pubDate.toDateString()}</time>
  <Content />
</article>
```

`render()` returns:

| Property | Type | Description |
|---|---|---|
| `Content` | Astro component | Compiled HTML as a renderable component |
| `headings` | `{ depth, slug, text }[]` | Extracted headings for TOC generation |

## Schema with Images

Use the `image()` helper to validate and optimize images in frontmatter:

```ts
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: image(),
      coverAlt: z.string(),
    }),
})
```

## Generating Pages from Collections

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, render } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }))
}

const { post } = Astro.props
const { Content } = await render(post)
---
<Content />
```

## Data Collections (Non-Content)

Use `file()` loader for structured data that doesn't need rendering:

```ts
const navigation = defineCollection({
  loader: file('src/data/navigation.json'),
  schema: z.object({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    order: z.number(),
  }),
})
```

Query the same way with `getCollection('navigation')`.

## Syncing

After schema changes, restart the dev server or run `astro sync` to regenerate types.
