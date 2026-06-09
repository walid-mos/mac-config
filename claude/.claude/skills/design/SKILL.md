---
name: design
description: >-
  UI/UX workflow for NextNode projects. Drives the impeccable design engine with
  NextNode brand tokens (teal/orange/navy, DM Sans, Tailwind theme). Load when
  designing or redesigning ANY UI, when the user says "design", "make it look
  good", "fix the UI/UX", or runs /design.
user-invocable: true
---

# NextNode Design

UI/UX on any project — marketing site, app, or dashboard — via the `impeccable`
plugin seeded with NextNode brand tokens and the correct register.

## Arguments

- No argument: run the full flow (engine check → seed → drive).
- `init`: only (re)seed impeccable's `PRODUCT.md` / `DESIGN.md` from the brand.

## Phase 0 — Engine check (once per machine)

Try `/impeccable`. If the command is unknown, the plugin isn't installed:

- Reproducible install: **`make claude-post`** (adds the `pbakaus/impeccable`
  marketplace and installs the plugin). Prefer this — it stays in sync with the
  Makefile as the plugin CLI evolves.
- One-off (CLI syntax may vary by Claude Code version): add the `pbakaus/impeccable`
  marketplace, then install the `impeccable` plugin, then reload plugins.

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
instead of impeccable's generic defaults. See **[seed-templates.md](seed-templates.md)**
for the exact content blocks.

Then run the impeccable flow normally: **`/impeccable shape` → `craft` → `audit`
→ `polish`** (and **`live`** for in-browser variant iteration).

### Phase 2 validation gate

Before proceeding through impeccable's flow, confirm all of these:

- [ ] `/impeccable init` accepted the seed without errors.
- [ ] Register (`brand` | `product`) confirmed and written to `PRODUCT.md`.
- [ ] Brand tokens (teal/orange/navy) reflected in `DESIGN.md` — no raw hex.
- [ ] Tailwind theme import (`@nextnode-solutions/standards/tailwind`) present.
- [ ] No hardcoded hex values in `DESIGN.md`.

## Hard rules

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Raw hex colors anywhere in code | Brand colors via Tailwind theme (`text-teal-500`, `bg-orange-500`) |
| Copying SVGs into the tree | Import logos from `@nextnode-solutions/brand-assets` subpath exports only |
| Modifying brand assets | Use `/nextnode-design` tokens as the source of truth |
| Restating impeccable's design doctrine in this skill | New design rules go in the project's `DESIGN.md` |
| Writing React/TS code without coding skills loaded | Load `/coding` + `/typescript` + `/react` before any `.tsx`/`.jsx` edit (CLAUDE.md governs this) |

> **Code handoff**: when design output becomes components, coding rules apply —
> load `/coding`, `/typescript`, `/react` per repo doctrine (CLAUDE.md). Design
> output never bypasses those rules.

> **FORBIDDEN**: adding design rules directly to this file. Rules belong in the
> project's `DESIGN.md` — impeccable reads it and quality compounds there.
