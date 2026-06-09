---
name: html
description: >-
  Generate a single self-contained HTML deliverable from a Claude ↔ user
  working session (plan, design, audit, retro, research, decision record).
  Picks the shape from intent, composes from a block library, defaults to
  NextNode branding. Load on "génère un html", "fais-moi un récap html",
  /interview validation, or any session whose output is a standalone HTML
  artifact (not a product UI).
user-invocable: true
---

# HTML

Form follows data. The same skill produces an implementation plan, a code review writeup, a retro, a research explainer, or a triage board — but each has its own shape. **Pick the shape from the intent. Never pour every output into the same 6-section markdown-in-HTML template.**

## Quick reference

| MANDATORY | FORBIDDEN |
|---|---|
| `--np-*` tokens everywhere — no hex outside `:root` / `[data-theme]` | Hardcoded `#0D9488` (teal-500) — wrong value, see `themes.md` |
| `mermaid` and `highlight.js` only from CDN, lazy-loaded | Any other CDN (analytics, UI frameworks, charting libs) |
| `<figure class="code-block">` with `language-*` class | Bare `<pre>` or `<pre><code>` without a `language-*` class |
| Sidebar for docs with ≥8 anchored sections | 6-section markdown-in-HTML template regardless of content |
| Export button on every editable block | `<textarea>` for prose fields (use `contenteditable`) |
| Anti-FOUC `<script>` first in `<head>` before stylesheet | Loading a CDN library when its target block isn't in the page |
| Load `./checklist.md` before declaring done | Inventing content to fill a block when the data isn't there |

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
2. **Set up the visual scaffolding** → read `./themes.md` for the `--np-*` token vocabulary, the anti-FOUC `<head>` bootstrap, and the skip-zones list. Drop these into every HTML you generate; they are non-negotiable.
3. **Compose from the block library** → read `./blocks.md`. For rich content (code, diffs, file trees, pills, Mermaid) → also read `./rich-blocks.md`. For custom-layout schemas (compare / stack / kinds / pool / timeline / inline SVG) → also read `./diagrams.md`.
4. **Rich mode** — load `./rich-mode.md` ONLY when the doc needs a feedback loop (typed decisions, anchored comments, tunable tokens). Otherwise stay in static mode — retros, audits, status reports need no submission protocol.

## Layout

- Single file. Inline CSS and JS. No bundler, no framework.
- **Max content width: 1120px**, centered. Drop to 720px when the doc is prose-only (research, retro narrative). Never cap at 800px reflexively — that's what makes everything feel like markdown.
- **Compact sidebar layout for long docs**: when the doc has ≥8 anchored sections (closure decisions, audit findings, board columns, long retros), switch to a 2-column layout — `grid-template-columns: 208px 1fr` (sidebar is *narrow* — nav rail, not reading column), sticky left rail with section nav + small completion dots + progress bar, collapsed under 1024px. Don't ship 8+ scrollable sections without a sidebar; the reader gets lost. Don't make it wider than ~210px either — it eats main content width.
- Mobile-first. Every grid collapses gracefully under 780px.
- CSS Grid for any multi-column block. Flex only for single-axis layouts.

### Visual scaffolding — see `./themes.md`

Every doc shares the same baseline: `--np-*` CSS tokens (palette NextNode, light + dark values), an anti-FOUC inline `<script>` in `<head>` before the stylesheet, and a list of skip-zones the rich-mode runtime never auto-edits. Full token vocabulary, bootstrap script, and skip-zone list are in `./themes.md` — load it whenever you generate HTML. **Rule of thumb: no hex literal outside `:root` / `[data-theme="dark"]`. Everything else uses `var(--np-…)`.**

## Interactivity

- **First-party vanilla JS is encouraged**, not banned. Drag-and-drop, filter chips, hover glossary, click-to-expand, copy buttons, slider-tuned animations — all welcome when the data justifies them.
- **Every editable block ships an export button** (markdown or JSON to clipboard). The HTML is a loop back into the agent, not a dead end.
- **CDN libraries — closed allowlist: `mermaid` and `highlight.js`.** Any other CDN is banned (no analytics, no trackers, no UI frameworks, no charting libs). Both are loaded *only when their target block is present in the page* — if there's no `<div class="mermaid">`, don't ship the Mermaid script. Pin a version (e.g. `mermaid@11`) and re-theme on `np:theme-change`.
- **Code blocks must use the full `code-block` recipe.** Never ship a bare `<pre>` or a `<pre><code>` without `language-…`. The recipe in `./rich-blocks.md` defines both the container CSS (padding, font, surface, border) and the hljs loader — the library colors tokens, the recipe owns the surface. Shipping one without the other produces the dead-monospace "wall of text" rendering. For any snippet with identity (file path, language label), wrap in `<figure class="code-block">` with file header + copy button.
- **No console errors** when opening the file.

## Branding

Brand tokens live in `./themes.md` — never inline hex values here. The value `#0D9488` / teal-500 is explicitly the **wrong** color for the primary accent (see `themes.md` § CSS tokens). Always derive from `--np-*` custom properties, never hardcode.

**Opt-out**: if the user explicitly asks for a doc-native palette (warmer, neutral, intent-specific), the brand defaults can be replaced. Stay disciplined — pick three to five colors, one display font, one body font, one mono. Never mix two palettes in the same doc.

## Output paths (static mode)

The canonical `docs/` layout is owned by the **`project-docs`** skill — load it for the contract. `html` writes to one of three locations:

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
- **No hex literal inside a component.** Colors / shadows / radii flow through `--np-*` tokens. A hardcoded `#0D9488` in a block is a bug, not a shortcut.
- Dark mode renders. Anti-FOUC `<script>` is present and runs before the stylesheet.
- No console errors. Third-party scripts limited to the closed allowlist (`mermaid`, `highlight.js`), loaded only when their target block exists.

### Sanity-check — run the pre-ship checklist

Before declaring done, load `./checklist.md` and verify every item. It covers the seven silent failure modes (id collisions, editable vs static prose, form name collisions, diff angle-bracket escaping, invalid rich-custom defaults, stray hex literals, broken code-block surface).
