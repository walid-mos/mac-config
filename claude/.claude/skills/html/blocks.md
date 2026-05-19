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

- **questions** — grilling round of `/interview`. One card per pending question, organized by branch. Each card carries: question text, **recommended answer** (highlighted accent box), the one-sentence tradeoff, an optional **diagram** when the choice has a spatial / structural dimension, then the answer input. Always a `Skip · re-grill later` button as the third path. Submission feeds back as `answers: {<question-id>: {choice?, choices?, freetext?, skip?, note?}}`. Skipping a question signals "regenerate with refined wording in the next round" — never a final answer.

  **Anti-patterns — never ship these:**

  - **Never render options twice.** A grid of "option cards" stacked on top of the radio-list duplicates the same content in two forms — the reader sees `(a) (b) (c)` as cards, then `(a) (b) (c)` as radios. Pick *one* visual: either a structural diagram (the recommended path, see `./diagrams.md`) **or** the radio-list — never both. If the question has a spatial dimension, ship a `.diag-flow` / `.diag-compare` / `.diag-stack` that *shows the topology* (not the same text reformatted into cards), then the radio-list for the input. The radios already carry the option labels — text cards above them are pure noise.
  - **Never reuse `--np-accent-bg` for a second "this is recommended" block.** The `.recommended` box (recommended-answer text, accent-bg fill) already owns that signal at the top of the card. A second element painted with the same `--np-accent-bg` (whether an "option card", a "primary row", or anything else) produces two visually identical teal-100 blocks side-by-side — same color, same role, redundant. The recommended option inside a diagram is signaled via *accent border* (3px-left or full 1px) + accent text on the row label + optionally one `.node.primary` tinted teal-500 inside the row — **not** by repainting the row fill with the teal-100 token.

  **Input type — pick the one that matches the question, never default to radio:**

  - `radio` (single `choice`) → the options are **mutually exclusive** alternatives. "Which lib", "which approach", "which deployment target". The recommended answer is one option pre-selected.
  - `checkbox` (multi `choices: string[]`) → the options are **orthogonal axes that combine**. "Which UX features do you want" (side-by-side + syntax + gutter + chrome-minimal), "which environments target this rollout", "which signals matter". The recommended answer is a **set** of pre-checked options + the bundled rationale. If the user can legitimately tick more than one, it's a checkbox — forcing a radio collapses real combinations into a fake single choice.
  - `textarea` (`freetext`) → genuinely open-ended, no enumerable options. Use sparingly — most questions can be enumerated.

  **Option count — content-driven, never padded:**

  - Minimum 2 (less than 2 isn't a question, it's a confirmation — drop it).
  - No fixed maximum. Radio: typically 2–5 distinct alternatives. Checkbox: up to 6–8 axes is fine (each is independent so cognitive load stays flat).
  - **Never invent a 4th option to round out a list of 3.** A weak 4th option that no one would ever pick is worse than 3 sharp ones — it dilutes the recommended answer and signals laziness. If only 2 real options exist, ship 2.

  **Per-question diagram — tabbed topologies (default pattern):**

  Whenever the choice has a spatial / structural / temporal dimension (where does X run? when does Y trigger? which path does Z follow?), ship a **tabbed diagram** between the recommended-answer box and the inputs — one tab per option, with the recommended one pre-active and badged.

  Data shape per question:

  ```js
  {
    id: 'q1',
    text: 'Where does X run?',
    recommended: 'b',
    // …
    diagCaption: "Où s'exécute la commande migrate",
    topologies: [
      { id: 'a', label: '(a) compose one-shot',
        body: '<span class="node">…</span>${A}<span class="node">…</span>',
        pros: ['Pattern simple', 'No external deps'],
        cons: ['Ships migrate image to VPS', 'SSH coupling'] },
      { id: 'b', label: '(b) CI via Tailscale', recommended: true,
        body: '<span class="node primary">…</span>${A}<span class="edge-label">Tailscale :5432</span>${A}<span class="node">…</span>',
        pros: ['Reuses infrastructure/ on the runner', 'Zero migrate image on VPS'],
        cons: ['Extra network surface (port 5432 on tailnet)'] },
      { id: 'c', label: '(c) init container',
        body: '<span class="node">…</span>${A}<span class="node">…</span>',
        pros: ['Compose-native ordering'],
        cons: ['User-image coupling', 'Migrate replayed on app restart'] },
    ],
  }
  ```

  Rendering contract:

  - **One pane per option** — never a single "recommended-only" diagram (the reader can't see what they'd be choosing against). Never 3 panes stacked in the same view (the screen turns into noisy comparison text — what the tabs are for is *to hide the alternatives until the user asks*).
  - **Default tab = the recommended option**, pre-active, with a small accent `rec-badge` ("recommandé") next to its label.
  - **Tab strip styling** — minimal underline tabs (à la GitHub): mono uppercase labels (~12px), `--np-text-muted` default, `--np-accent-hover` on `.active`, 2px `--np-accent` underline via `::after` on the active tab. **Not** card-lift tabs with bg-soft strip + bg fill on active — that's heavy. The simple underline reads cleaner.
  - **Pane body** — single horizontal `.diag-body` flex row: `.node` boxes + inline SVG `.arrow-svg` connectors + optional `.edge-label` mono strings. **The active topology's central node** carries `.node.primary` — `background: var(--np-accent-bg)` + `border: 1px solid var(--np-accent)` + `color: var(--np-accent-hover)`, **outline+tint, never saturated fill** (per `./themes.md` § Accent usage). Non-recommended topologies have no `.primary` — they're rendered in plain neutral.
  - **Caption underneath**, mono uppercase, separated by a dashed top border (same as static diagrams).
  - **State** — persist the active tab in `state.diagTab[questionId]` so re-renders (skip toggle, etc.) don't reset it. Attach a click handler that toggles `.active` on both `.diag-tab[data-diag-tab]` and `.diag-pane[data-diag-pane]`.
  - **Pros / cons per pane** — each topology carries `pros: string[]` and `cons: string[]` arrays. The rendered pane shows the diagram body + a compact `▸ Pros & cons` toggle button (mono uppercase, outline). On click, expands a 2-column grid (`pros` left in accent-hover heading, `cons` right in muted heading) under the diagram. Persist the open/closed state **per question** (`state.diagDetails[questionId] = boolean`) — NOT per tab. When the user opens pros/cons on one tab then switches to another, the new tab inherits the open state and shows ITS pros/cons immediately. The toggle click propagates the new state across all panes' `.diag-details` and `.diag-details-toggle` in the question (one boolean drives every pane's open class + button label). Keep collapsed by default — always-expanded pros/cons clutter the pane and defeat the tabs. Skip pros/cons entirely on a topology only if there's nothing meaningful to say (rare — most decisions have at least 1-2 of each).

  **Existing → proposed migrations** use the same primitive: ship two tabs labeled `EXISTANT` and `PROPOSED` (`recommended: true` on the proposed one), each carrying the topology of that state. The reader flips between current and target, sees the delta visually.

  **Other primitives (`./diagrams.md`) — use when tabs don't fit:**

  - "X vs Y" binary decision where both states are equally important to see simultaneously → `.diag-compare` (side-by-side panes, no tabbing).
  - Discriminated-union type choices (kind A/B/C, each with distinct fields, not a topology) → `.diag-kinds`.
  - Layered architecture (where does logic live, across layers) → `.diag-stack`.
  - When the diagram is auto-laid-out flow with >4 nodes or branching → `mermaid` (per `./rich-blocks.md`).

  The bar is the same as for closure: *is text faster than a picture here?* For a "where does X run / when does Y trigger" choice, tabs+topologies are almost always faster. Skip the diagram when the question is purely textual (naming, copy, ordering, yes/no on a non-spatial concept) — Q2/Q5 patterns (policy / lifecycle text-only choices) don't need one.

- **resolved-summary** — read-only context shown at the top of grilling rounds 2..N. Compact list of `question → resolved answer` pairs, one per line. Each row has a `Re-open` link that flips the question back into the active `questions` block (rare; lets the user backtrack one cell without restarting the round). Omit in round 1.

- **decisions** — one section per decision, with **six mandatory fields** (Fact / Mechanism / Edge / Rejected / Order / Verification — see `../interview/closure.md` for field semantics). All six are required; never ship a card with a missing or hand-wavy field. In rich mode, every field is editable and submitted back through `decisions`/`edits`/`comments` so the user can fix any cell before validating.

  **Mandatory UX patterns for `Interview · closure`** (a flat grid of decision cards is a smell — never ship that):

  - **Compact sidebar**: 2-column grid (`grid-template-columns: 208px 1fr` — *narrow*, not 260+; nav rail, not reading column). Left = sticky sidebar (`position:sticky; top:0; height:100vh; overflow:auto`, ~12-px text, 5-px scrollbar) listing every decision grouped by theme, each link with a small 7-px completion dot (filled green = complete, hollow amber = missing field), plus links to Risks / Next steps and a `Cellules complètes X/N` progress bar. Right = main content. Collapse under 1024px (`display:none`).
  - **ScrollSpy**: `IntersectionObserver` on every `.decision` section + the major sections, highlighting the matching sidebar link as the user scrolls (`rootMargin: '-20% 0px -65% 0px'`). Without this the sidebar is dead weight.
  - **Decisions as sections, not cards**: each decision is an `<article class="decision">` separated by a thin `border-bottom: 1px solid var(--line-soft)` — no rounded card box. Anchor id `dec-<slug>`. Theme group is a `<div class="theme-block">` with anchor id `theme-<key>`.
  - **Collapse-by-default — diagram + fact-preview, click for details**: by default each decision shows only `head + diagram + .fact-preview` (the Fact rendered as readable prose in a tinted-left-border block) + a `▸ Détails · 6 champs` toggle. The 6 fields (`.fields-grid`) are `display:none` until the user clicks Détails — then `.fact-preview` hides and the 6 fields appear. Toggle text becomes `▾ Réduire`. Track expanded ids in `state.expanded`. When the user edits the Fact field, sync the value back into `.fact-preview.textContent`.
  - **Field rendering — prose-first, never raw textareas in fixed boxes** (this is what makes the difference between a form and a deliverable):
    - Each of the 6 fields renders as a `.field-prose` block — same visual language as `.fact-preview`: tinted left border (4px accent), generous padding (~12px 14px), readable line-height (1.5+), font-size matching the body prose. **No fixed height. No inner scroll. Ever.** The block grows with its content; if the prose is 8 lines, the block is 8 lines tall.
    - Editable via `contenteditable="true"` on the prose block itself — *not* a `<textarea>` wrapper. Contenteditable grows naturally with content and inherits the prose typography, so reading and editing share the exact same visual. A textarea inside a fixed-height card is a smell — it crops the prose and forces the user to scroll inside a 100px box to read a 6-line Mechanism. **Never ship that.**
    - Add a small `[F]` / `[M]` / `[E]` / `[R]` / `[O]` / `[V]` accent badge in front of each block as the field label (mono, uppercase, ~10px) so the six are scannable without a heavy `<label>` row above each.
    - Hover state: `box-shadow: inset 0 0 0 1px var(--accent-tint)` so the user sees the block is editable. Focus state: solid 1px accent border + slight bg shift. No giant chrome.
    - On `input`, persist into `state.decisions[decisionId][field]` (read via `el.textContent`). On submit, the `decisions` payload is built from this state — never from textarea values.
    - Layout: 2-column CSS grid (`repeat(2, minmax(0, 1fr))`, ~16px gap) on wide screens, single column under 720px. The grid auto-rows to the *tallest* sibling per row — so paired fields (Fact/Mechanism, Edge/Rejected, Order/Verification) align even when one is shorter. Use `align-items: start` so a short field doesn't get padded to match a tall neighbour.
  - **Per-decision afterthought textarea** (always visible, even when collapsed): a `<textarea class="decision-note" data-note="<decisionId>" placeholder="💬 Afterthought, question, doute pour Claude…">` sitting next to the Détails toggle in a `.decision-footer` flex row. Empty state: dashed `var(--line)` border, transparent bg — almost invisible. With content: accent-colored solid border + `var(--accent-tint)` bg + `has-value` class so it draws the eye. Auto-grow on input (cap ~200px). Persist in `state.notes` keyed by decision id. On submit, build `comments: [{target: decisionId, body: trim(note)}]` from non-empty notes and include it in the payload. This is the user's feedback channel back to Claude — they comment as they scan, Claude reads `submission.json` and either discusses or updates the plan. **Don't ship a closure without this.** (This one *is* a textarea because it's a true input field with placeholder semantics, not a prose block.)
  - **Diagram per decision when spatial info adds value** (most decisions in a closure benefit). See `diagrams.md`. Decisions where text already says everything (pure ordering, pure rejection rationale, "no rétrocompat") can skip the diagram — but the bar is "is text faster than a picture here?", and the answer is usually no.

- **risk-grid** — 3-column grid: risk · severity badge (high/med/low) · mitigation. Not a `<table>` — use CSS grid for mobile.
- **findings-grid** — same shape as `risk-grid` but for audit findings (issue · severity · recommendation).
- **annotated-diff** — code diff blocks with margin notes (`<aside>` floated right), severity tags, anchor links to jump.
- **file-by-file** — collapsed `<details>` per file, each containing the why + the relevant hunk.
- **review-focus** — small callout listing what the author wants the reviewer to focus on.
- **open-questions** — left-bordered cards (accent), question + description + owner. Omit if empty.
- **next-steps** — checklist with checkboxes, optional owners and dates. **Include a "Copy as backlog prompt" button** (vanilla JS).
  - For the `Interview · closure` recipe, the button **copies the `backlog-bundle.json`** payload (the canonical handoff to `/backlog` — see `../interview/closure.md` § 5.b for the schema). Build the bundle in-page from the same state used to render the closure (decisions + change_kind + target hints + open_facts), `JSON.stringify` it, and write it to the clipboard. Label the button accordingly (e.g. `Copy backlog bundle (JSON)`).
  - For all other recipes (plans, retros, audits…), the button copies a clean markdown summary prompt-ready for paste into `/backlog` — same legacy behavior.
- **action-items** — same as `next-steps` but for retros.
- **board** — drag-and-drop columns (Now / Next / Later / Cut, or whatever the data needs). Cards draggable between columns. Export-as-markdown button.
- **mini-chart** — small inline SVG chart (bars or sparkline). No chart libraries.
- **interactive-figure** — a focused interactive widget (slider tuning, click-through, live ring, etc.) when the concept requires it. One per doc, max.
- **glossary** — terms on the right margin, hover-linked from the prose.
- **prose-columns** — long-form text in 1 or 2 columns (max-width 65ch per column).
- **shipped / slipped** — two parallel lists with short rows and tags.
- **export-button** — copy-to-clipboard button that emits a clean markdown or JSON version of the editable state. Mandatory for any block that lets the user edit (board, prompt-tuner, etc.).

## Rich content primitives — see `./rich-blocks.md`

`code-block`, `diff`, `file-tree`, `pill`, and `mermaid` are documented separately in `./rich-blocks.md`: drop-in HTML5 markup + the required CSS + the lazy loader for the two CDN libraries (highlight.js, Mermaid). Load that ref whenever the doc renders code, diffs, an impacted-files tree, semantic badges, or auto-laid-out flowcharts.
