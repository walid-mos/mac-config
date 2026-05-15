# Block library

Each block has a fixed semantic role and a default visual. Adapt the visual to the content — but keep the role.

- **header** — eyebrow (kind + scope), `<h1>`, optional `prompt-box` echoing the user's ask. ~120px tall.
- **tldr** — 2–4 sentence summary in a tinted box. Mandatory for anything longer than two screens.
- **summary-strip** — 3–5 key/value cells in a grid (effort, surfaces touched, flag name, date). Quick-scan row at the top of plans.
- **context** — 2–4 short paragraphs. Use only when the reader needs background; skip otherwise.
- **timeline** — vertical timeline with a dot column, dates on the left, milestone body on the right, tags at the bottom. For plans (weeks) or post-mortems (minutes).
- **flow-diagram** — inline SVG. Boxes + arrows. Solid lines for sync paths, dashed for async/realtime. Edge labels in muted grey, callouts in accent.
- **module-map** — inline SVG. Packages as boxes, hot path highlighted, entry points listed beside.
- **mockup-tile** — small HTML/CSS mockups (not screenshots). Embedded `<div>` layouts that render the proposed UI. Caption underneath.

- **branches-tree** — discovery round of `/interview`. Single-column dense list, grouped by theme, collapsed-by-default. Every card has a `theme` (kebab-case slug), title, one-sentence description, "matters because" line, and in-scope/out-of-scope toggle. Submission feeds back as `branches: [{id, theme, title, description, matters, scope: "in"|"out"}]`.

  **Mandatory UX patterns** (a flat list of editable textareas is a smell — never ship that):

  - **Theme grouping**: each branch carries a `theme` (e.g. `schema`, `routing`, `isolation`, `image`, `deploy`, `compat`). The page declares a `THEMES` array (id + human label) and renders one `theme-group` section per theme that has at least one visible branch. User-added branches go into an "Added" group. 2–4 branches per theme is the sweet spot; rebalance if a theme has >5.
  - **Sticky filter bar** at the top (`position:sticky;top:0`). Three chips: `Toutes <N>` / `In-scope <N>` / `Out-of-scope <N>` with live counts. Plus a `Tout déplier / Tout replier` toggle. Filter hides non-matching cards (and empty theme groups).
  - **Collapse-by-default**: each card collapsed = ~50–80px tall, showing `chevron · title · matters-preview (one line, ellipsized) · In/Out toggle`. Click anywhere on the summary (except the In/Out buttons or the contenteditable title) → expand. Expanded card reveals editable `description` and `matters` textareas + a `Supprimer` action. State: a `Set` of expanded ids.
  - **Out-of-scope visual mute**: `opacity:0.55`, strikethrough title, muted-grey left border (instead of accent). User scans progress instantly.
  - **Inline edit, no always-on textareas**: title is `<div contenteditable="true">` in the summary (becomes editable on focus). Description and matters live inside the expanded body and use `<textarea>` with auto-grow. The collapsed summary shows only the matters preview, never an empty editor.
  - **Single column**, gap ~6px between cards. Not a 2-column grid — at this density, two columns waste horizontal scan-space.

  Include a `+ Ajouter une branche` button below the list. New branches auto-expand and focus the title field. A short `freeform` textarea below the add button captures contextual notes that don't fit a branch.

- **questions** — grilling round of `/interview`. One card per pending question, organized by branch. Each card carries: question text, **recommended answer** (highlighted accent box), the one-sentence tradeoff, then the answer input. Input type matches the question: radio for multiple-choice (2–4 options provided), textarea for open-ended, always a `Skip · re-grill later` button as the third path. Submission feeds back as `answers: {<question-id>: {choice?, freetext?, skip?, note?}}`. Skipping a question signals "regenerate with refined wording in the next round" — never a final answer.

- **resolved-summary** — read-only context shown at the top of grilling rounds 2..N. Compact list of `question → resolved answer` pairs, one per line. Each row has a `Re-open` link that flips the question back into the active `questions` block (rare; lets the user backtrack one cell without restarting the round). Omit in round 1.

- **decisions** — one section per decision, with **six mandatory fields** (Fact / Mechanism / Edge / Rejected / Order / Verification — see `../interview/closure.md` for field semantics). All six are required; never ship a card with a missing or hand-wavy field. In rich mode, every field is editable and submitted back through `decisions`/`edits`/`comments` so the user can fix any cell before validating.

  **Mandatory UX patterns for `Interview · closure`** (a flat grid of decision cards is a smell — never ship that):

  - **Compact sidebar**: 2-column grid (`grid-template-columns: 208px 1fr` — *narrow*, not 260+; nav rail, not reading column). Left = sticky sidebar (`position:sticky; top:0; height:100vh; overflow:auto`, ~12-px text, 5-px scrollbar) listing every decision grouped by theme, each link with a small 7-px completion dot (filled green = complete, hollow amber = missing field), plus links to Risks / Next steps and a `Cellules complètes X/N` progress bar. Right = main content. Collapse under 1024px (`display:none`).
  - **ScrollSpy**: `IntersectionObserver` on every `.decision` section + the major sections, highlighting the matching sidebar link as the user scrolls (`rootMargin: '-20% 0px -65% 0px'`). Without this the sidebar is dead weight.
  - **Decisions as sections, not cards**: each decision is an `<article class="decision">` separated by a thin `border-bottom: 1px solid var(--line-soft)` — no rounded card box. Anchor id `dec-<slug>`. Theme group is a `<div class="theme-block">` with anchor id `theme-<key>`.
  - **Collapse-by-default — diagram + fact-preview, click for details**: by default each decision shows only `head + diagram + .fact-preview` (the Fact rendered as readable prose in a tinted-left-border block) + a `▸ Détails · 6 champs` toggle. The 6 textareas (`.fields-grid`) are `display:none` until the user clicks Détails — then `.fact-preview` hides and the 6 editable textareas appear. Toggle text becomes `▾ Réduire`. Track expanded ids in `state.expanded`. When the user edits the Fact textarea, sync the value back into `.fact-preview.textContent`. Without this collapse, ~12 decisions × 6 textareas of dense prose = unreadable page.
  - **Per-decision afterthought textarea** (always visible, even when collapsed): a `<textarea class="decision-note" data-note="<decisionId>" placeholder="💬 Afterthought, question, doute pour Claude…">` sitting next to the Détails toggle in a `.decision-footer` flex row. Empty state: dashed `var(--line)` border, transparent bg — almost invisible. With content: accent-colored solid border + `var(--accent-tint)` bg + `has-value` class so it draws the eye. Auto-grow on input (cap ~200px). Persist in `state.notes` keyed by decision id. On submit, build `comments: [{target: decisionId, body: trim(note)}]` from non-empty notes and include it in the payload. This is the user's feedback channel back to Claude — they comment as they scan, Claude reads `submission.json` and either discusses or updates the plan. **Don't ship a closure without this.**
  - **Diagram per decision when spatial info adds value** (most decisions in a closure benefit). See `diagrams.md`. Decisions where text already says everything (pure ordering, pure rejection rationale, "no rétrocompat") can skip the diagram — but the bar is "is text faster than a picture here?", and the answer is usually no.

- **risk-grid** — 3-column grid: risk · severity badge (high/med/low) · mitigation. Not a `<table>` — use CSS grid for mobile.
- **findings-grid** — same shape as `risk-grid` but for audit findings (issue · severity · recommendation).
- **annotated-diff** — code diff blocks with margin notes (`<aside>` floated right), severity tags, anchor links to jump.
- **file-by-file** — collapsed `<details>` per file, each containing the why + the relevant hunk.
- **review-focus** — small callout listing what the author wants the reviewer to focus on.
- **open-questions** — left-bordered cards (accent), question + description + owner. Omit if empty.
- **next-steps** — checklist with checkboxes, optional owners and dates. **Include a "Copy as backlog prompt" button** (vanilla JS, copies a clean prompt-ready summary).
- **action-items** — same as `next-steps` but for retros.
- **board** — drag-and-drop columns (Now / Next / Later / Cut, or whatever the data needs). Cards draggable between columns. Export-as-markdown button.
- **mini-chart** — small inline SVG chart (bars or sparkline). No chart libraries.
- **interactive-figure** — a focused interactive widget (slider tuning, click-through, live ring, etc.) when the concept requires it. One per doc, max.
- **glossary** — terms on the right margin, hover-linked from the prose.
- **prose-columns** — long-form text in 1 or 2 columns (max-width 65ch per column).
- **shipped / slipped** — two parallel lists with short rows and tags.
- **export-button** — copy-to-clipboard button that emits a clean markdown or JSON version of the editable state. Mandatory for any block that lets the user edit (board, prompt-tuner, etc.).
