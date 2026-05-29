---
name: design
description: >-
  Top-tier UI/UX workflow for any NextNode project, built on the impeccable
  plugin (Paul Bakaus, Apache-2.0). The engine owns design doctrine (brief
  inference, typography, color, spatial, motion, interaction, responsive, ux
  writing, anti-slop detection, audit/polish pre-flight). This skill is a thin
  NextNode layer: it installs the engine, seeds it with the NextNode brand and
  the right register, and wires repo conventions. Load when designing or
  redesigning ANY UI in a NextNode project, when the user says "design", "make
  it look good", "fix the UI/UX", or runs /design.
user-invocable: true
---

# NextNode Design

Incomparable UI/UX on any project — marketing site, app, or dashboard.

**The design engine is the `impeccable` plugin.** It owns the craft: 7 reference
domains (typography, color & contrast in OKLCH, spatial, motion, interaction,
responsive, ux-writing), a brand-vs-product register, 27 deterministic
anti-pattern rules, and the audit/polish pre-flight gate.

This skill is a **thin NextNode layer**. It does **not** re-implement any design
doctrine — duplicating impeccable would create the exact "third hybrid pattern"
the repo doctrine forbids. It only: (1) ensures the engine is installed,
(2) seeds it with the NextNode brand + correct register, (3) wires repo
conventions.

> **Build-or-Borrow**: impeccable is borrowed as a Claude Code **plugin** — the
> platform-native path, which has absolute precedence. Never re-derive its rules
> here. New design rules belong in the project's `DESIGN.md` (impeccable reads
> it), not in this file.

## Arguments

- No argument: run the full flow (engine check → seed → drive).
- `init`: only (re)seed impeccable's `PRODUCT.md` / `DESIGN.md` from the brand.

## Phase 0 — Engine check (once per machine)

Try `/impeccable`. If the command is unknown, the plugin isn't installed:

- Reproducible install: **`make claude-post`** (adds the `pbakaus/impeccable`
  marketplace and installs the plugin).
- One-off: `claude plugin marketplace add pbakaus/impeccable && claude plugin install impeccable@impeccable`, then reload plugins.

## Phase 1 — Read the project & pick the register

1. Run **`/nextnode-design`** first to load brand tokens: teal primary, orange
   accent, dark-mode ground navy `#141A30`; Plus Jakarta Sans / DM Sans /
   JetBrains Mono; Tailwind theme from `@nextnode-solutions/standards/tailwind`;
   logos from `@nextnode-solutions/brand-assets`.
2. Pick impeccable's **register**:
   - **brand** → marketing sites, landing pages, portfolios, editorial.
   - **product** → app UI, dashboards, forms, data tables, settings.
   - The internal `@nextnode-solutions/monitoring` dashboard uses the separate
     **Navy** language — never seed it with the client brand.

## Phase 2 — Seed impeccable, then let it drive

Run **`/impeccable init`** and fill its `PRODUCT.md` + `DESIGN.md` from NextNode
instead of impeccable's generic defaults:

**PRODUCT.md**
- **Register**: brand | product (from Phase 1).
- **Users**: French PME/ETI clients and their end-users. Pitch at PME/ETI
  maturity — not enterprise, not toy.
- **Brand Personality**: trustworthy, clear, competent — an externalized-CTO
  voice. Confident, never hype-y.
- **Anti-references** (NextNode, layered on impeccable's): no generic-AI-SaaS
  look (purple gradients, glassmorphism, neon-on-black); no "agency theatre" —
  clarity and trust over flash; no enterprise-grade density for a PME audience.

**DESIGN.md** (tokens) — mirror NextNode, never invent a palette:
- Primary **teal** (CTAs, links, primary UI); accent **orange** (highlights
  only — never a primary action); dark-mode ground navy `#141A30`.
- Fonts: Plus Jakarta Sans (display/hero only), DM Sans (everything else),
  JetBrains Mono (code).
- Source of truth is the Tailwind theme — export tokens, don't hardcode hex.

Then run the impeccable flow normally: **`/impeccable shape` → `craft` → `audit`
→ `polish`** (and **`live`** for in-browser variant iteration).

## Repo conventions (hard)

- **Code generation is not impeccable's job here.** When a design becomes
  components, hand off to repo doctrine: load `/react` (+ `/coding`,
  `/typescript`) for any `.tsx`/`.jsx`. Design output never bypasses those rules.
- **Brand colors via the Tailwind theme**, never raw hex (`text-teal-500`,
  `bg-orange-500`). Import `@nextnode-solutions/standards/tailwind`.
- **Logos from `@nextnode-solutions/brand-assets`** subpath exports only — never
  copy SVGs into the tree, never modify them.
- Respect `nextnode-standards` tooling (oxlint / oxfmt / TS config).

## What this skill deliberately does NOT do

- Restate typography / color / spacing / motion rules → impeccable's 7 reference
  files own that.
- Define anti-patterns → impeccable's 27 deterministic rules + critique pass.
- Run the pre-flight gate → `/impeccable audit` + `/impeccable polish`.

If tempted to add a design rule here, add it to the project's `DESIGN.md`
instead — impeccable reads it and keeps quality compounding across the project.
