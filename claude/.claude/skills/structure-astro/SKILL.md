---
name: structure-astro
description: "MANDATORY target structure for ALL Astro projects. Auto-load when working on ANY Astro-based project — enforces domain-driven component organization, shared/page separation, and lib layer conventions. This skill is ALWAYS loaded alongside the astro skill."
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
  - /Users/walid/Development/clients
---

# Astro Project Structure Standard

Canonical `src/` layout for **ALL** Astro projects. Every Astro project MUST follow this structure — no exceptions, regardless of project origin (NextNode, client, personal).

## Core Principle

**Two-zone separation**: page-specific sections (`components/`) live apart from reusable building blocks (`shared/`). Pure logic (`lib/`) has zero `.astro` files. Interactive islands (`islands/`) are physically separated from static components.

---

## Directory Map

```
src/
├── components/                     # Page-specific domain sections (.astro)
│   ├── home/                       # Homepage sections
│   ├── <page-name>/                # One folder per page
│   └── ...
│
├── shared/                         # Reusable across pages (.astro)
│   ├── layout/                     # Structural shell (Navigation, Footer)
│   ├── ui/                         # Presentational primitives (no domain logic)
│   └── forms/                      # Inquiry/contact forms + shared base
│
├── islands/                        # Interactive hydrated components (.tsx)
│   ├── shared/                     # Reusable interactive components
│   │   ├── ui/                     # MobileMenu, Lightbox, CookieConsent
│   │   └── forms/                  # FormStepper, DatePicker, FileUpload
│   └── <page-name>/                # Page-specific interactive components
│
├── lib/                            # Pure TypeScript — zero .astro files
│   ├── utils/                      # Stateless pure functions
│   ├── services/                   # Side effects, external I/O
│   ├── config/                     # App-wide configuration objects
│   ├── types/                      # Shared TypeScript types/interfaces
│   ├── constants/                  # Static values, enums, route paths
│   ├── hooks/                      # React/Preact hooks (for islands only)
│   ├── stores/                     # Client-side state (nanostores)
│   └── validators/                 # Zod schemas for form validation
│
├── layouts/                        # Astro layouts (structural page wrappers)
├── pages/                          # Astro file-based routing (RESERVED)
├── data/                           # Content collections (markdown, JSON)
├── assets/                         # Processed assets (images optimized by Astro)
│   └── images/
│       └── <domain>/               # One folder per domain (bouquets/, mariages/...)
├── styles/                         # Global CSS (fonts, variables, resets)
└── content.config.ts               # Content collection schemas
```

---

## Rules

### 1. `components/` — Page Sections

- One subfolder per page, matching the route name in `pages/`
- Each folder contains the sections that compose that page
- Drop the page prefix from filenames — the folder IS the namespace
- Example: `MariagesHero.astro` becomes `components/mariages/Hero.astro`

```
components/
├── home/
│   ├── Hero.astro
│   ├── Bouquets.astro
│   └── Pricing.astro
├── mariages/
│   ├── Hero.astro
│   ├── Story.astro
│   └── Gallery.astro
└── abonnement/
    ├── Hero.astro
    ├── Experience.astro
    └── HowItWorks.astro
```

**FORBIDDEN:**
- Flat component files in `components/` root — always use a domain subfolder
- Cross-page imports between domain folders (use `shared/` instead)

### 2. `shared/` — Reusable Astro Components

Three categories, no more:

| Folder | Contents | Rule |
|--------|----------|------|
| `layout/` | Navigation, Footer, SkeletonHero | Structural wrappers used on every page |
| `ui/` | OptimizedImage, PullQuote, GoogleMap | Stateless, no domain knowledge, pure presentation |
| `forms/` | Base form + specialized variants | Grouped because they share logic |

**Rule:** A component moves to `shared/` only when it is used by 2+ pages. Do not preemptively share.

### 3. `islands/` — Interactive Components

- `.tsx` files only — these are hydrated with `client:*` directives
- Mirrors the same domain structure as `components/`
- `islands/shared/` for cross-page interactive components
- `islands/<page>/` for page-specific interactive components

**Rule:** If a component needs no JS interactivity, it belongs in `components/` or `shared/`, not `islands/`.

### 4. `lib/` — Pure TypeScript

Zero `.astro` or `.tsx` files. Importable from anywhere.

| Folder | Contains | Can import from |
|--------|----------|-----------------|
| `types/` | TypeScript types/interfaces | nothing (leaf) |
| `constants/` | Static values, enums, routes | `types/` only |
| `config/` | Site metadata, nav structure | `types/`, `constants/` |
| `utils/` | Pure functions, no side effects | `types/`, `constants/` |
| `validators/` | Zod schemas for forms/data | `types/`, `constants/` |
| `hooks/` | React/Preact hooks | anything in `lib/` |
| `stores/` | Nanostores for client state | `types/`, `constants/` |
| `services/` | External I/O (API, email, analytics) | anything in `lib/` |

**Dependency flow (strictly one-way):**

```
services/ ──→ utils/ ──→ constants/ ──→ types/
hooks/    ──→ stores/ ──→ validators/
```

No circular imports. No upward dependencies.

**Rule:** Create `lib/` subfolders only when needed. An empty `lib/types/` folder is worse than no folder at all. Add subfolders as the project grows.

### 5. `layouts/`, `pages/`, `data/`, `styles/`

- `layouts/` — Astro layouts. Usually just `Layout.astro`. Add more only for distinct page structures.
- `pages/` — Astro reserved directory. Keep flat for simple sites. Use subdirectories only for nested routes.
- `data/` — Content collections. One subfolder per collection (`events/`, `blog/`, etc.).
- `styles/` — Global CSS only (`global.css`, `fonts.css`). Component styles stay in `.astro` `<style>` blocks.

### 6. `assets/images/`

- One subfolder per domain: `bouquets/`, `mariages/`, `about/`, etc.
- Keep `logo.png` (and similar root assets) at `assets/images/` root
- NEVER put images in `public/` unless they must bypass Astro's image optimization

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Domain folders | kebab-case | `mariages/`, `home/` |
| Astro components | PascalCase | `Hero.astro`, `Gallery.astro` |
| Islands (React) | PascalCase | `MobileMenu.tsx`, `ImageLightbox.tsx` |
| Lib files | kebab-case | `format-date.ts`, `contact-form.ts` |
| Type files | kebab-case | `events.ts`, `common.ts` |
| Style files | kebab-case | `global.css`, `fonts.css` |

---

## Import Patterns

Page imports should group by origin, with a blank line between groups:

```astro
---
// Layout
import Layout from '../layouts/Layout.astro'

// Shared components
import Navigation from '../shared/layout/Navigation.astro'
import Footer from '../shared/layout/Footer.astro'
import PullQuote from '../shared/ui/PullQuote.astro'

// Page sections
import Hero from '../components/mariages/Hero.astro'
import Story from '../components/mariages/Story.astro'
import Gallery from '../components/mariages/Gallery.astro'

// Forms
import InquiryForm from '../shared/forms/MariagesInquiryForm.astro'
---
```

---

## Boundary Summary

```
Static world (.astro)           Interactive world (.tsx)
─────────────────────           ────────────────────────
components/<page>/              islands/<page>/
shared/layout/                  islands/shared/
shared/ui/                      lib/hooks/
shared/forms/                   lib/stores/

              lib/utils/
              lib/services/
              lib/types/           ← pure TS, shared by both
              lib/validators/
              lib/constants/
              lib/config/
```
