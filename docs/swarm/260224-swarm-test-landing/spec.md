# Spec: Test Landing Page

> Minimal static landing page to validate the `/swarm` shell orchestration pipeline end-to-end.

## Context

This is a **test spec** — intentionally small (1 iteration, 2-3 tasks). The goal is to verify that `swarm.sh` correctly sequences all phases: decompose → plan → test → code → review → security → lint → build → commit.

## Tech Stack

- HTML + Tailwind CSS (CDN — no build step beyond a static file check)
- Vitest + happy-dom for unit tests
- No framework (plain `.html` + `.ts` utility files)

## Requirements

### FR-1: Hero Section

Create `src/pages/index.html` with:

- A centered hero section containing:
  - An `<h1>` with text "Welcome to Swarm Test"
  - A `<p>` subtitle with text "This page was built by the swarm pipeline."
  - A CTA button with text "Get Started" linking to `#features`
- Use Tailwind utility classes for styling (CDN `<script>` tag)
- Responsive: text should scale appropriately on mobile (use `text-3xl md:text-5xl` pattern)
- Minimum contrast ratio: white text on a dark background (`bg-gray-900 text-white`)

### FR-2: Features Grid

Below the hero, add a features section (`id="features"`) with:

- A section heading `<h2>` "Features"
- A 3-column responsive grid (`grid-cols-1 md:grid-cols-3`) with 3 feature cards
- Each card contains:
  - An icon placeholder (emoji or SVG — e.g., rocket, lightning, shield)
  - A title (`<h3>`)
  - A short description (`<p>`)
- Card data is defined in `src/lib/features.ts` as a typed array and exported

### FR-3: Feature Data Module

Create `src/lib/features.ts`:

```typescript
export interface Feature {
  icon: string
  title: string
  description: string
}

export const features: Feature[] = [
  { icon: '🚀', title: 'Fast', description: 'Blazing fast build pipeline.' },
  { icon: '⚡', title: 'Parallel', description: 'Agents work in parallel for maximum throughput.' },
  { icon: '🛡️', title: 'Safe', description: 'Mandatory security review on every iteration.' },
]
```

This module must be testable independently of the HTML.

## Acceptance Criteria

1. `index.html` renders without errors when opened in a browser
2. All Tailwind classes produce visible styling (CDN loaded)
3. The CTA button links to `#features` and the features section exists with that ID
4. `features.ts` exports a `features` array with exactly 3 items
5. Each feature has non-empty `icon`, `title`, and `description`
6. Unit tests cover the `features.ts` module (array length, types, non-empty fields)
7. `pnpm build` (or equivalent static check) passes
8. Zero lint errors
