---
name: plan-html
description: >-
  Generate a single self-contained HTML deliverable that captures the output of
  a Claude ↔ user working session (plan, design, audit, retro, research,
  decision record). Picks the document SHAPE from the intent, composes blocks
  from a library (timelines, flow diagrams, mockup tiles, risk grids, boards,
  mini-charts, annotated diffs), and defaults to NextNode branding.
  Load whenever the conversation ends with "génère un html", "fais-moi un
  récap html", `/interview` validation, or any workflow whose output is a
  standalone HTML artifact (not a product UI).
user-invocable: true
---

# Plan HTML

Form follows data. The same skill produces an implementation plan, a code review writeup, a retro, a research explainer, or a triage board — but each has its own shape. **Pick the shape from the intent. Never pour every output into the same 6-section markdown-in-HTML template.**

## When to load

- Plans, roadmaps, backlogs, RFCs
- Implementation plans (timelines + data-flow + risks)
- Design or architecture decisions
- Audits, retrospectives, post-mortems
- Research / concept explainers
- Resolved `/interview` output

Do **not** load for: marketing pages, product UIs, demos, anything where HTML is the product itself.

## Prerequisites

- Load `nextnode-design` (sections `colors` and `typography`) for brand tokens unless the user opts out (see *Branding* below).
- Load **`project-docs`** if unsure which `docs/<kind>/` folder the artifact belongs to — it owns the canonical layout.

## Pipeline

1. **Pick the shape** → read `./recipes.md` for the intent → recipe table.
2. **Compose from the block library** → read `./blocks.md`. For any spatial content (most closure decisions, plans, audits), also read `./diagrams.md` for the `.diag-*` primitives.
3. **If the artifact must round-trip through the user as typed data** (decisions, comments, tunable tokens) → read `./rich-mode.md` for the submission protocol, output path, and `rp` server loop. Otherwise stay in static mode.

## Layout

- Single file. Inline CSS and JS. No bundler, no framework.
- **Max content width: 1120px**, centered. Drop to 720px when the doc is prose-only (research, retro narrative). Never cap at 800px reflexively — that's what makes everything feel like markdown.
- **Compact sidebar layout for long docs**: when the doc has ≥8 anchored sections (closure decisions, audit findings, board columns, long retros), switch to a 2-column layout — `grid-template-columns: 208px 1fr` (sidebar is *narrow* — nav rail, not reading column), sticky left rail with section nav + small completion dots + progress bar, collapsed under 1024px. Don't ship 8+ scrollable sections without a sidebar; the reader gets lost. Don't make it wider than ~210px either — it eats main content width.
- Mobile-first. Every grid collapses gracefully under 780px.
- CSS Grid for any multi-column block. Flex only for single-axis layouts.

## Interactivity

- **First-party vanilla JS is encouraged**, not banned. Drag-and-drop, filter chips, hover glossary, click-to-expand, copy buttons, slider-tuned animations — all welcome when the data justifies them.
- **Every editable block ships an export button** (markdown or JSON to clipboard). The HTML is a loop back into the agent, not a dead end.
- **No third-party scripts.** No analytics, no trackers, no CDN libraries. Inline only.
- **No console errors** when opening the file.

## Branding

Default: NextNode brand from `nextnode-design`.

- Primary: `#0D9488` (teal-500) — accents, links, primary buttons.
- Accent: `#F97316` (orange-500) — highlights, severity-high badges, the export button.
- Light bg: `#F8FAFC`. Text on light: `#141A30`.
- Dark bg: `#141A30`. Text on dark: `#F8FAFC`.
- Respect `prefers-color-scheme`.
- Fonts: Plus Jakarta Sans (700/800) for `<h1>` + eyebrow only · DM Sans (400/500/600) everywhere else · JetBrains Mono (400) for `<code>` and `<pre>`. One `<link>` to Google Fonts.

**Opt-out**: if the user explicitly asks for a doc-native palette (warmer, neutral, intent-specific), the brand defaults can be replaced. Stay disciplined — pick three to five colors, one display font, one body font, one mono. Never mix two palettes in the same doc.

## Output paths (static mode)

The canonical `docs/` layout is owned by the **`project-docs`** skill — load it for the contract. `plan-html` writes to one of three locations:

- **Implementation plan** → `./docs/plans/<YYYY-MM-DD>-<slug>.html`
- **Interview closure** (rich mode) → `./docs/interviews/<slug>/plan.html` (see `rich-mode.md`; never write a closure to `plans/`)
- **Any other recipe** (audit, review, retro, research, status, board, …) → `./docs/notes/<YYYY-MM-DD>-<slug>.html`

Create the directory if missing (lazy, `mkdir -p`). After writing, open the file:

1. `mcp__claude-in-chrome__navigate` with a `file://` URL if the extension is connected.
2. Otherwise `open -g <path>` on macOS (**background obligatoire — `open` nu vole le focus**) or `xdg-open` on Linux.

If a caller skill (e.g. `/interview`) specifies a different output directory, honor it.

## Quality bar

Before declaring done:

- The shape matches the intent. A timeline-heavy artifact has a timeline. A diff-heavy one has an annotated diff. Not the other way around.
- At least one block carries **spatial information** (SVG diagram, mockup tile, timeline, board) unless the doc is pure prose. Walls of `<h2>` + `<p>` are a smell.
- For `Interview · closure`: every decision with any spatial / structural / sequential payload gets its own diagram (tree, flow, compare, kinds, pool, stack, timeline, or inline SVG). Plain six-field text with no schema is a smell — the reader should grasp each decision in 2s by glancing at the diagram before reading the cells.
- Every editable block has an export button.
- Brand colors and fonts correct (or opted-out consistently). No off-brand greys, no `#000000`, no pure white when on NextNode default.
- Dark mode renders.
- No console errors. No third-party scripts.
