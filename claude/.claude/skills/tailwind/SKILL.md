---
name: tailwind
description: Tailwind CSS code standards. Use when writing or reviewing Tailwind utility classes in any template or component.
user-invocable: false
---

# Tailwind Standards

## Core Rules

- ALWAYS inline utility classes — NEVER extract to constants or CSS files
- Custom CSS is FORBIDDEN — only exceptions: complex animations, pseudo-selectors Tailwind can't handle
- `cva` is the ONLY abstraction allowed for class variants
- `cn()` (clsx + twMerge) is MANDATORY when available — NEVER template literals for classes

## Class Organization (single line per breakpoint)

```
base dark:dark-variant
sm:responsive md:responsive lg:responsive
hover:interactive focus:interactive
```

- `dark:` variants WITH the base state on the same element
- One line per responsive breakpoint when it gets long
- Group: layout > sizing > spacing > typography > colors > effects

## Forbidden Patterns

- String concatenation for classes: `` `text-${size}` `` — use a map or cva
- Extracting classes to JS constants (except cva)
- `@apply` in CSS files — defeats the purpose of utility-first
- Inline `style={}` attributes — use Tailwind utilities instead
- Over-segmented class strings across multiple variables

## Spacing & Sizing

- Use Tailwind scale values — NEVER arbitrary values unless design-system aligned
- Consistent spacing: pick a scale and stick to it (4px base: `p-1`, `p-2`, `p-4`, `p-8`)
- `size-*` shorthand over separate `w-*` + `h-*` when both are identical
