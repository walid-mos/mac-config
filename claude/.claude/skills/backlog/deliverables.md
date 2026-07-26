# HTML deliverables

Every user-facing checkpoint of this skill is an HTML document built with the
`html` skill — **load it first and follow it entirely** (block vocabulary in
its `reference.md`, build script, rich mode, `rp` serving). This file only
fixes what that skill leaves to the caller: paths, shapes, and what goes in
each document.

All documents for one feature share `docs/interviews/<feature-slug>/`, in the
target project's repo. Serve rich-mode documents with `rp <slug>` and give
the user the URL; open read-only ones with `open -g`.

## Gate 2 — `round-<n>.html` (rich mode)

One document per interview round. Shape: rich-mode interview.

- One `<section data-group="<Domaine>">` per decision domain (Données,
  Contrats, États, Auth, Échecs, Tests, …) → the runtime paginates; a round
  spanning several domains is pages, never one scroll.
- Every question is a `form.rich-question` with `data-recommended`
  pre-selected. `.q` ≤6 words; the stake goes in `.recommended`/`.rq-stake`.
- Trivial choice → bare `.opt` list. Weighed choice → `rq-axes` with an
  example and a color-coded consequence per cell, plus `.rq-schema` when
  spatial (a data-shape choice, a flow variant).
- Open the round with a short context strip: what was learned from the
  previous round, what this round unlocks.
- Facts you looked up that motivate a question sit next to it (a `fold` with
  the relevant excerpt), so the user decides in full knowledge.
- The **final round** appends a `Récapitulatif` section — every decision
  taken, one line each, editable — whose approval closes the grill.

## Gate 3 — `spec.html` (read-only)

Shape: research/explainer, `-w prose` if mostly text. Sections = the skeleton
in [`spec-template.md`](spec-template.md), each with an `id`; `data-group`
only if the spec genuinely spans domains.

Diagrams, when the data is spatial — never to decorate:

- **Data model** → D2 (`<div data-np="d2">`): entities, fields that matter,
  relations. One diagram, in *Décisions d'implémentation*.
- **State machines** → mermaid `stateDiagram-v2`, one per entity that has
  states — including the unwanted transitions (expiry, failure).
- **User flows** → mermaid `flowchart` for multi-step journeys, failure
  paths included.
- **Contracts** → a table per endpoint (entrées / sorties / codes / erreurs),
  tabs (`data-np="tabs"`) when >3 endpoints — the reader compares, they don't
  read in order.

## Gate 4 — `breakdown.html` (rich mode)

Shape: triage board + decision record hybrid.

- **Vue d'ensemble** section: a mermaid `flowchart` of the dependency
  graph — one node per ticket labelled with its outcome title (short form),
  one edge per blocking relation, tickets clustered by epic (`subgraph`),
  frontier nodes visually marked. This is the one diagram that is always
  present: the edges are the decision under review.
- One `<section data-group="<Épique>">` per epic → one page per epic. Inside:
  the epic's outcome, then each ticket as a card — title, what it delivers,
  blocked by, and its body in a `fold` (the exact HTML that will land in
  Plane, in a `figure.code-block` so it is copy-checkable).
- **Gate agent-ready** section: the results table — one row per ticket,
  failed check numbers or `ok`. A ticket with failures is visibly not
  publishable.
- Per-ticket rich-mode question where a real alternative exists: merge with
  its neighbour, split, re-order an edge — recommendation pre-selected.
  No fabricated questions on tickets that are plainly right.
- The document's Approve gate is the publication trigger: `approved` →
  publish to Plane immediately per [`plane.md`](plane.md), no restating;
  `rejected` → fold the annotations in, re-ship.

## After publishing

Report in chat, compact: epic identifiers and titles, ticket count per epic,
the frontier, anything degraded. If the run produced many items or a partial
degradation, append a `publication.html` (status-report shape: strip +
twocol published/degraded) — otherwise chat alone is enough.

## Discipline

The `html` skill's weight rules apply unchanged: a block earns its place by
carrying data; no diagram for a checkbox; folds for raw detail. A two-question
round is still a valid document — small, one view, no sidebar.
