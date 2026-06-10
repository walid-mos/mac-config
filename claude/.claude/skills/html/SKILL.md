---
name: html
description: >-
  Generate a single self-contained HTML deliverable (plan, audit, review,
  retro, research, decision record, triage board). Token-optimized: you write
  only the semantic body content; a build script wraps it with the shared
  NextNode stylesheet + runtime (theme, sidebar, copy buttons, diff parser,
  lazy mermaid/hljs). Load on "génère un html", "fais-moi un récap html", or
  any session whose output is a standalone HTML artifact (not a product UI).
user-invocable: true
---

# HTML

Form follows data. The same skill produces an implementation plan, a review writeup, a retro, a research explainer, or a triage board — each with its own shape. Pick the shape from the intent; never pour every output into the same 6-section markdown-in-HTML template.

**You write only the body content.** All chrome (tokens, dark mode, anti-FOUC, theme toggle, sidebar + scrollspy, copy buttons, diff rendering, CDN lazy-loaders) is pre-built in `assets/` and assembled by the build script. Re-typing any of it is a bug, not thoroughness.

## Pipeline

1. **Pick the shape** from the intent (table below). Compose freely from the block vocabulary — the table is a starter, not an enclosure.
2. **Read `./reference.md`** for the markup vocabulary (block classes, data-islands, rich-mode forms).
3. **Write the body fragment** to a temp file (e.g. `/tmp/<slug>.body.html`): semantic markup only — sections, blocks, inline SVG. No `<html>`, no `<head>`, no stylesheet, no runtime script.
4. **Build**:
   ```bash
   bash ~/.claude/skills/html/scripts/build.sh /tmp/<slug>.body.html \
     -t "Titre du document" -o docs/notes/<YYYY-MM-DD>-<slug>.html
   ```
   Flags: `-l` lang (default `fr`) · `-m rich` feedback-loop mode · `-w prose` 760px reading width · `-s on|off` force sidebar (auto: shows at ≥6 `section[id]`) · `-b` brand label.
5. **Open it**: `open -g <path>` on macOS (background obligatoire — `open` nu vole le focus), `xdg-open` on Linux, or the Chrome MCP with a `file://` URL if connected.

## Shapes

| Intent | Composition |
|---|---|
| Implementation plan | header + strip + file-tree + timeline + flow diagram + risk-grid + next-steps |
| Code review writeup | header + tldr + diff + file-by-file + pills by severity |
| Architecture audit | header + svg module map + findings + risk-grid + next-steps |
| Retro / post-mortem | header + timeline (minute-by-minute) + twocol good/bad + next-steps |
| Research / explainer | header + tldr + prose sections (`-w prose`) + diagrams + sources |
| Triage / backlog board | header + board data-island (`-m rich` if decisions come back) |
| Decision record | header + diag-compare or ctable + callout (decision) + risk-grid |
| Status report | header + strip + timeline + twocol shipped/slipped |

## Rules

- **Content only, never invented**: if the data for a block isn't there, omit the block.
- **Per-doc custom styling is allowed** — one `<style>` at the top of the body fragment — but only `var(--np-*)` tokens, **no color literal**. New color = new token in `np.css`, not a hex in the doc.
- **At least one spatial block** (diagram, SVG, timeline, board) unless the doc is pure prose. Walls of `<h2>` + `<p>` are a smell.
- **Real architecture schemas → D2.** A `<div data-np="d2">` block is rendered at build time to inline SVG (light + dark, zero CDN) — prefer it over hand-built `.diag-*` whenever the topology is non-trivial. Requires `d2` (`make claude-post`). See reference.md.
- **Accent discipline**: saturated `--np-accent` = the lone primary CTA + thin indicators only. Highlight blocks use `--np-bg-soft` + 4px accent left border, never an `--np-accent-bg` fill. Orange is never a primary action.
- **Code blocks**: always `<figure class="code-block" data-file="…">` + `language-*` class. Escape `<`/`>` inside `.diff` content.
- **Every interactive/editable doc exports**: copy buttons (`data-copy`, board exports) are the loop back into the agent — never ship a dead end.
- **CDN allowlist is closed** (mermaid, highlight.js — auto-loaded by the runtime). Never add another `<script src>`.
- **Section ids**: explicit `id` on every `<section>` you anchor; unique, kebab-case. The sidebar builds itself from `section[id] > h2`.

## Output paths

- Implementation plan → `docs/plans/<YYYY-MM-DD>-<slug>.html`
- Rich-mode interview closure → `docs/interviews/<slug>/plan.html`
- Everything else → `docs/notes/<YYYY-MM-DD>-<slug>.html`

A caller skill that specifies a different path wins.

## Rich mode (`-m rich`)

For docs whose answers must come back as typed data (open questions, decisions, tunable values, board ordering). The runtime auto-instruments prose as contenteditable (skip-zones: pre, table, diagrams, forms, `.static`), collects `form.rich-question` answers, `[data-token]` inputs and board state, and injects a sticky Approve/Reject gate that POSTs to `./submit` (clipboard fallback if no server). Contract on return: `approval_mode: "approved"` → start implementing immediately, no restating; `"rejected"` → don't implement, ask for direction. Serve with `rp <slug>` in background and give the user the URL (read it from stdout / `.rp-url` — never assume the port).

## Before declaring done

- Shape matches intent; every section anchored; no invented content.
- Body fragment contains no hex/oklch literal and no chrome duplication (`grep -nE '#[0-9A-Fa-f]{3,8}|oklch\(' /tmp/<slug>.body.html` → only hits inside an explicitly justified `<style>` are acceptable, ideally zero).
- Built file opens without console errors; dark mode renders (toggle it once).
- Rich mode only: every radio group has exactly one `checked`, distinct `name`s, valid defaults.
