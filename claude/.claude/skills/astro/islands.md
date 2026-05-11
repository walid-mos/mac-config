# Islands, Client Directives & View Transitions

## Islands Architecture

Astro ships zero JavaScript by default. Interactive UI components are "islands" - isolated, hydrated components in a sea of static HTML. Only add JavaScript where interactivity is needed.

## Client Directives

Client directives control when and how a UI framework component (React, Vue, Svelte, etc.) hydrates on the client. Without a directive, the component renders to static HTML only.

| Directive | Hydrates when | Use case |
|---|---|---|
| `client:load` | Page loads | Critical interactive UI (nav menus, auth) |
| `client:idle` | Browser is idle | Below-fold interactive content |
| `client:visible` | Component enters viewport | Lazy-loaded widgets, comments |
| `client:media="(query)"` | Media query matches | Mobile-only components |
| `client:only="react"` | Page loads (no SSR) | Components that cannot run on server |

```astro
<!-- Hydrate immediately -->
<Counter client:load />

<!-- Hydrate when visible -->
<HeavyChart client:visible />

<!-- Hydrate on mobile only -->
<MobileMenu client:media="(max-width: 768px)" />

<!-- Skip SSR entirely - client-only rendering -->
<BrowserOnlyWidget client:only="react" />
```

### Rules

- **Astro components never need client directives** - they are always static HTML.
- Only UI framework components (React, Vue, Svelte, Solid, etc.) accept `client:*`.
- Prefer `client:visible` or `client:idle` over `client:load` to reduce initial JS.
- `client:only` requires the framework name as a string value and skips server rendering entirely.

## `server:defer`

Defer server-rendered component loading with a fallback:

```astro
<Avatar server:defer>
  <svg slot="fallback" class="placeholder">...</svg>
</Avatar>
```

The component renders on the server asynchronously and replaces the fallback when ready.

## Scripts in `.astro` Files

### Bundled scripts (default)

```astro
<script>
  import { setupForm } from '@/scripts/form.ts'
  setupForm()
</script>
```

- Bundled, deduplicated, and tree-shaken by Astro's build pipeline.
- TypeScript supported natively.
- Runs once even if the component appears multiple times.

### Inline scripts

```astro
<script is:inline>
  // NOT bundled - injected raw into the HTML
  // No import support, no TypeScript
  console.log('inline')
</script>
```

Use `is:inline` only for third-party snippets that must be injected verbatim (analytics, pixel tracking).

### Passing data from server to client

Use `data-*` attributes - there is no direct frontmatter-to-script bridge:

```astro
---
const userId = 'abc123'
---
<div id="app" data-user-id={userId}></div>
<script>
  const el = document.querySelector('#app')
  const userId = el?.dataset.userId
</script>
```

Or use `define:vars` for simple values (creates inline script variables):

```astro
---
const message = 'hello'
---
<script define:vars={{ message }}>
  // `message` is available here as a JS variable
  // WARNING: this makes the script inline (not bundled)
  console.log(message)
</script>
```

## View Transitions

### Setup

Add `<ClientRouter />` to the `<head>` (typically in a shared layout):

```astro
---
import { ClientRouter } from 'astro:transitions'
---
<head>
  <ClientRouter />
</head>
```

This enables:
- Client-side navigation (SPA-like, no full page reloads)
- Animated page transitions
- Persistent elements across pages

### Transition directives

```astro
<!-- Named transition for cross-page animation -->
<h1 transition:name="title">{title}</h1>

<!-- Built-in animations: fade, slide, none -->
<div transition:animate="slide">Content</div>

<!-- Persist element across navigations (no re-render) -->
<audio transition:persist>
  <source src="/music.mp3" />
</audio>
```

### Lifecycle events

Listen for navigation events in client scripts:

```astro
<script>
  document.addEventListener('astro:before-preparation', (event) => {
    // Before new page is fetched
  })
  document.addEventListener('astro:after-swap', (event) => {
    // After new page DOM is swapped in
  })
  document.addEventListener('astro:page-load', (event) => {
    // After page load (initial + each navigation)
    // Use this instead of DOMContentLoaded
  })
</script>
```

### Script re-execution

With `<ClientRouter />`, bundled `<script>` tags in `<head>` run once on initial load. Scripts in `<body>` re-run on each navigation. Use `astro:page-load` for setup that must re-run.
