# Styling

## Scoped Styles (Default)

`<style>` tags in `.astro` files are scoped automatically. Astro adds a unique attribute to elements and selectors so styles never leak between components:

```astro
<style>
  /* Only applies to <h1> elements in THIS component */
  h1 { color: red; }
</style>
<h1>Scoped</h1>
```

## Global Styles

### `is:global` directive

Escape scoping for a full style block:

```astro
<style is:global>
  /* Applies globally - use sparingly */
  body { margin: 0; }
</style>
```

### `:global()` selector

Target global selectors within a scoped block:

```astro
<style>
  /* Scoped to this component */
  .wrapper { padding: 1rem; }

  /* Global - targets children rendered by framework components or <slot> content */
  .wrapper :global(h2) { color: blue; }
</style>
```

### Global stylesheet

Import a CSS file in a layout for site-wide styles:

```astro
---
// src/layouts/Base.astro
import '@/styles/global.css'
---
```

## `class:list` Directive

Build class strings from mixed types. Falsy values are excluded:

```astro
---
const isActive = true
---
<div class:list={['card', { active: isActive }]}>
```

Accepts: strings, `{ class: boolean }` objects, arrays (flattened). `undefined`, `null`, `false` are ignored.

## `define:vars` - CSS Custom Properties from Frontmatter

Pass server-side values to CSS:

```astro
---
const accentColor = '#ff6b00'
const fontSize = '1.2rem'
---
<style define:vars={{ accentColor, fontSize }}>
  h1 {
    color: var(--accentColor);
    font-size: var(--fontSize);
  }
</style>
<h1>Dynamic styles</h1>
```

Variables are set as inline `style` attributes on the component's root element using `--varName` naming.

## External Stylesheets

### Import in frontmatter

```astro
---
import '@/styles/theme.css'
import 'open-props/style'
---
```

Imported CSS is bundled, minified, and optimized by Astro's build pipeline.

### `<link>` tag

```astro
<link rel="stylesheet" href="/styles/legacy.css" />
```

Files in `public/` are served as-is, not processed by Astro.

## CSS Modules

Rename `.css` to `.module.css` and import named classes:

```astro
---
import styles from './Card.module.css'
---
<div class={styles.card}>
  <h2 class={styles.title}>Hello</h2>
</div>
```

## Tailwind CSS

Install via integration:

```sh
npx astro add tailwind
```

Use classes directly in `.astro` templates. Tailwind works with scoped styles and `class:list`:

```astro
<div class:list={['flex gap-4', { 'opacity-50': disabled }]}>
```

## Best Practices

- Prefer scoped `<style>` over global styles. Keep global CSS to resets, fonts, and CSS custom properties.
- Use `class:list` for conditional classes instead of string concatenation.
- Use `define:vars` to bridge server values to CSS instead of inline `style` attributes.
- Import CSS in frontmatter (not `<link>`) to benefit from bundling and optimization.
- Use `:global()` selector sparingly and only to style slotted/child content from framework components.
