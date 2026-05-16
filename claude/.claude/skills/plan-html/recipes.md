# Recipes

Match the intent to a recipe. Each recipe is a **composition of blocks** from `blocks.md` — never a fixed section list.

| Intent | Recipe |
|---|---|
| Implementation plan | `header` + `summary-strip` + `timeline` + `flow-diagram` (SVG) + `mockup-tile`* + `risk-grid` + `next-steps` |
| Interview · discovery (round 0) | `header` + `context` + `branches-tree` |
| Interview · grilling (rounds 1..N) | `header` + `resolved-summary`* + `questions` (each card may embed a diagram primitive when the choice is spatial — see `diagrams.md`) |
| Interview · closure (final) | `header` + `decisions` + `risk-grid` + `open-questions`* + `next-steps` |
| Code review writeup | `header` + `tldr` + `annotated-diff` + `file-by-file` + `review-focus` |
| Architecture audit | `header` + `module-map` (SVG) + `findings-grid` + `risk-grid` + `next-steps` |
| Retrospective / post-mortem | `header` + `timeline` (minute-by-minute) + `what-worked` / `what-didnt` + `action-items` |
| Research / concept explainer | `header` + `tldr` + `prose-columns` + `interactive-figure`* + `glossary`* |
| Triage / backlog board | `header` + `board` (drag-drop columns) + `export-button` |
| Status report | `header` + `summary-strip` + `mini-chart` + `shipped` / `slipped` |

`*` optional. If the data isn't there, omit the block. **Do not invent content to fill a block.**

If none of these fit, compose your own from the block library. The table is a starter, not an enclosure.
