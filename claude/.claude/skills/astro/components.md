# Components

## Structure

Every `.astro` file is a component. Two sections separated by a code fence (`---`):

1. **Frontmatter** (top) — runs on the server at build/request time. Imports, data fetching, variable declarations.
2. **Template** (bottom) — HTML output with embedded JS expressions.

```astro
---
// Frontmatter: server-side JS/TS
import Header from '../components/Header.astro'
const title = 'Hello'
---
<!-- Template: HTML + expressions -->
<Header />
<h1>{title}</h1>
```

Components with no frontmatter can omit the fences entirely.

## Props

Access props via `Astro.props`. Define a `Props` type for type safety:

```astro
---
interface Props {
  title: string
  description?: string
}

const { title, description } = Astro.props
---
<h1>{title}</h1>
{description && <p>{description}</p>}
```

Always destructure `Astro.props` — never reference `Astro.props.x` in the template.

## Slots

### Default slot

```astro
---
// Card.astro
---
<div class="card">
  <slot />
</div>
```

### Named slots

```astro
---
// Layout.astro
---
<header>
  <slot name="header" />
</header>
<main>
  <slot />
</main>
<footer>
  <slot name="footer" />
</footer>
```

Usage:

```astro
<Layout>
  <h1 slot="header">Title</h1>
  <p>Main content goes in the default slot.</p>
  <p slot="footer">Copyright 2026</p>
</Layout>
```

### Fallback content

```astro
<slot>
  <p>This renders when no children are passed.</p>
</slot>
```

## Template Expressions

Curly braces `{}` embed JS expressions in the template:

```astro
---
const items = ['A', 'B', 'C']
const show = true
---
<!-- Conditional -->
{show && <p>Visible</p>}
{show ? <p>Yes</p> : <p>No</p>}

<!-- List -->
<ul>
  {items.map((item) => <li>{item}</li>)}
</ul>

<!-- Fragment (no wrapper element) -->
<>
  <p>First</p>
  <p>Second</p>
</>
```

## `class:list` Directive

Build class strings from mixed types. Falsy values are excluded:

```astro
---
const isActive = true
const variant = 'primary'
---
<div class:list={['card', variant, { active: isActive, hidden: false }]}>
  <!-- renders: class="card primary active" -->
</div>
```

Accepts: strings, objects (`{ className: boolean }`), arrays (flattened), `Set`, `undefined`/`null`/`false` (ignored).

## `set:html` Directive

Inject raw HTML. Equivalent to `innerHTML` — **never use with untrusted input** (XSS risk):

```astro
---
const raw = '<strong>Bold</strong>'
---
<div set:html={raw} />
```

## `set:text` Directive

Set text content safely (HTML-escaped):

```astro
---
const userInput = '<script>alert("xss")</script>'
---
<div set:text={userInput} />
<!-- renders: &lt;script&gt;alert("xss")&lt;/script&gt; -->
```

## `define:vars` Directive

Pass frontmatter variables to `<style>` and `<script>` tags:

```astro
---
const color = 'red'
---
<style define:vars={{ color }}>
  h1 { color: var(--color); }
</style>
<h1>Colored heading</h1>
```

## Component Composition

Astro components compose like HTML. Import and nest freely:

```astro
---
import Card from './Card.astro'
import Button from './Button.astro'
---
<Card>
  <h2 slot="header">Title</h2>
  <p>Content</p>
  <Button slot="footer">Click</Button>
</Card>
```

Keep components small and single-purpose. Extract repeated markup into components — even for static HTML with no props.
